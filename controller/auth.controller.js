const { db } = require("../database");
const Joi = require("joi");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const CreateUser = async (req, res) => {
  // verify with JOI
  const schema = Joi.object({
    username: Joi.string().min(3).max(30).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().min(7).max(15).required(),
    store_name: Joi.string().min(3).max(30).required(),
    password: Joi.string().min(6).max(30).required(),
  });

  const { error } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({
      message: error.details[0].message.replace(/\"/g, ""),
      data: {},
    });
  }

  const { username, email, fullname, bio, password } = req.body;

  // check if email already exists
  const [rows] = await db.execute("SELECT * FROM users WHERE email = ?", [
    email,
  ]);

  if (rows.length > 0) {
    return res.status(400).json({
      message: "Email already exists",
      data: {},
    });
  }

  // encrypt password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // create user
  const [result] = await db.execute(
    "INSERT INTO users (username, email, fullname,bio, password) VALUES (?, ?, ?, ?, ?)",
    [username, email, fullname, bio, hashedPassword]
  );

  if (result.affectedRows > 0) {
    return res.status(201).json({
      message: "User created",
      data: {
        id: result.insertId,
        username,
        email,
        fullname,
        bio,
      },
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await db.execute("SELECT * FROM users WHERE email=?", [
      email,
    ]);
    if (rows.length === 0) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }
    const user = rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ message: "Invalid email or password" });
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
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "An error occurred while logging in" });
  }
};

module.exports = { login, CreateUser };
