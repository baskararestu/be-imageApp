const { db } = require("../database");
const Joi = require("joi");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Mail = require("nodemailer/lib/mailer");
const upload = require("../middleware/multer");
const nodemailer = require("../middleware/nodemailer");

const { getUserIdFromToken } = require("../helper/jwt-payload.helper");

const CreateUser = async (req, res) => {
  // verify with JOI
  const schema = Joi.object({
    username: Joi.string().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(30).required(),
    confirmPassword: Joi.string()
      .valid(Joi.ref("password"))
      .required()
      .messages({
        "any.only": "Confirm password must match password",
        "any.required": "Confirm password is required",
      }),
  });

  const { error } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({
      message: error.details[0].message.replace(/\"/g, ""),
      data: {},
    });
  }

  const { username, email, password } = req.body;

  const [rows] = await db.execute(
    "SELECT * FROM users WHERE email = ? OR username = ?",
    [email, username]
  );

  if (rows.length > 0) {
    const error = {};
    if (rows[0].email === email) {
      error.email = "Email already exists";
    }
    if (rows[0].username === username) {
      error.username = "Username already exists";
    }
    return res.status(400).json({
      message: "Validation error",
      data: { error },
    });
  }

  // encrypt password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // create user
  const [result] = await db.execute(
    "INSERT INTO users (username, email, password, isVerified) VALUES (?, ?, ?,false)",
    [username, email, hashedPassword]
  );

  let payload = {
    id: result.insertId,
  };
  console.log(payload);
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
  console.log(token);
  let mail = {
    from: `Admin <baskararw10@gmail.com>`,
    to: `${email}`,
    subject: `Verfied your account`,
    html: `
        <div>
          <p>Thanks for registering! Please click the following link to verify your account:</p>
          <a href="http://localhost:3000/verification/${token}">Click Here</a>
        </div>
          `,
  };
  let response = await nodemailer.sendMail(mail);
  console.log(response);

  if (result.affectedRows > 0) {
    return res.status(201).json({
      message: "User created",
      data: {
        id: result.insertId,
        username,
        email,
      },
    });
  }
};

const verification = async (req, res) => {
  try {
    // Get the user ID from the token
    const userId = getUserIdFromToken(req, res);
    console.log(userId);
    // Update the isVerified field in the database for the user with the given ID
    const [results] = await db.query(
      `UPDATE users SET isVerified = ? WHERE id_user = ?`,
      [true, userId]
    );

    // If the query was successful, send a success response
    if (results.affectedRows > 0) {
      res
        .status(200)
        .send({ success: true, message: "Your account is verified" });
    } else {
      res
        .status(500)
        .send({ success: false, message: "Failed to update user" });
    }
  } catch (error) {
    // If an error occurs, send an error response
    console.error(error);
    res.status(500).send({ success: false, message: "Internal server error" });
  }
};

const resendVerification = async (req, res) => {
  const { email } = req.body;

  try {
    // Retrieve the user from the database based on the email
    const [rows] = await db.execute("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const user = rows[0];
    console.log(user);
    if (user.isVerified) {
      return res.status(400).json({
        message: "User is already verified.",
      });
    }

    // Generate a new verification token
    const token = jwt.sign({ id: user.id_user }, process.env.JWT_SECRET, {
      expiresIn: "10m",
    });

    // Update the user's verification token and isVerified status in the database
    await db.execute(
      "UPDATE users SET verificationToken = ? WHERE id_user = ?",
      [token, user.id_user]
    );

    // Send the verification email
    const mail = {
      from: `Admin <baskararw10@gmail.com>`,
      to: `${email}`,
      subject: `Verfied your account`,
      html: `
        <div>
          <p>Thanks for registering! Please click the following link to verify your account:</p>
          <a href="http://localhost:3000/verification/${token}">Click Here</a>
        </div>
      `,
    };

    await nodemailer.sendMail(mail);

    return res.status(200).json({
      message: "Verification email sent successfully.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Verification link expired ",
    });
  }
};

const forgetPassword = async (req, res) => {
  const { email } = req.body;

  try {
    // Retrieve the user from the database based on the email
    const [rows] = await db.execute("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const user = rows[0];
    // Generate a reset password token
    const token = jwt.sign({ id: user.id_user }, process.env.JWT_SECRET, {
      expiresIn: "30m",
    });

    // Update the user's verification token (reset password token) in the database
    await db.execute(
      "UPDATE users SET resetPasswordToken = ? WHERE id_user = ?",
      [token, user.id_user]
    );

    // Send the reset password email
    const mail = {
      from: "Admin <baskararw10@gmail.com>",
      to: email,
      subject: "Reset Your Password",
      html: `
        <div>
          <p>You have requested to reset your password. Please click the following link to proceed:</p>
          <a href="http://localhost:3000/reset-password/${token}">Reset Password</a>
        </div>
      `,
    };

    await nodemailer.sendMail(mail);

    return res.status(200).json({
      message: "Reset password email sent successfully.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "An error occurred while processing your request.",
    });
  }
};

const resetPassword = async (req, res) => {
  const { newPassword, confirmPassword } = req.body;
  const token = req.headers.authorization.split(" ")[1]; // Assuming the token is passed as "Bearer <token>"

  try {
    // Verify the token
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decodedToken.id;
    console.log(userId, "reset pw");

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password in the database
    await db.execute("UPDATE users SET password = ? WHERE id_user = ?", [
      hashedPassword,
      userId,
    ]);

    return res.status(200).json({
      message: "Password reset successful.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "An error occurred while resetting the password.",
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await db.execute("SELECT * FROM users WHERE email=?", [
      email,
    ]);
    const user = rows[0];
    console.log(user.password);
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ message: "Invalid password", success: false });
      return;
    }

    // check token login
    let payload = {
      id: user.id_user,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // If we get here, the email and password are valid
    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id_user,
        email: user.email,
        username: user.username,
        fullname: user.fullname,
        bio: user.bio,
      },
      success: true,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "An error occurred while logging in" });
  }
};

const fetchUserById = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req, res);
    console.log(userId, "test");
    const [results] = await db.query(
      `SELECT id_user,fullname,email,username,bio,image,isVerified FROM users WHERE id_user = ${userId}`
    );
    if (results.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.status(200).json(results[0]);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const editUserById = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req, res);
    const { username, password, fullname, bio } = req.body;
    const [rows] = await db.execute("SELECT * FROM users WHERE id_user=?", [
      userId,
    ]);
    if (rows.length === 0) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    const user = rows[0];
    // check if the username is already taken by another user
    if (username && username !== user.username) {
      const [usernameRows] = await db.execute(
        "SELECT * FROM users WHERE username=? AND id_user!=?",
        [username, userId]
      );
      if (usernameRows.length > 0) {
        res.status(400).json({ message: "Username already taken" });
        return;
      }
    }
    // encrypt new password if provided
    let hashedPassword = user.password;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password, salt);
    }
    // handle file upload with Multer
    let imageUrl = user.image;
    const { file } = req;
    if (file) {
      imageUrl = "/" + file.filename;
    }

    // update user
    await db.execute(
      "UPDATE users SET username=?, password=?, fullname=?, bio=?, image=? WHERE id_user=?",
      [
        username || user.username,
        hashedPassword,
        fullname || user.fullname,
        bio || user.bio,
        imageUrl,
        userId,
      ]
    );
    res.status(200).json({ message: "User updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "An error occurred while updating user" });
  }
};

module.exports = {
  login,
  CreateUser,
  verification,
  resendVerification,
  forgetPassword,
  resetPassword,
  fetchUserById,
  editUserById,
};
