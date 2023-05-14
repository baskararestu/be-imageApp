const { db } = require("../database");
const { getUserIdFromToken } = require("../helper/jwt-payload.helper");
const upload = require("../middleware/multer");
const Joi = require("joi");

const addContent = async (req, res) => {
  try {
    const addContentSchema = Joi.object({
      caption: Joi.string().max(200).required(),
    });

    // validate input using Joi schema
    const { caption } = await addContentSchema.validateAsync(req.body);

    // get user id from token
    const userId = getUserIdFromToken(req, res);

    // const { caption, createAt, id_content } = req.body;
    // handle file upload with Multer
    let image = "";
    const { file } = req;
    if (file) {
      image = "/" + file.filename;
    } else {
      throw new Error("Image is required");
    }

    // insert new content
    await db.execute(
      "INSERT INTO contents (caption, createAt, image, id_user) VALUES (?, NOW(), ?, ?)",
      [caption, image, userId]
    );

    res.status(201).json({ message: "Content added successfully" });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message });
  }
};

const showAllContent = async (req, res) => {
  try {
    // get all content with their corresponding usernames and creation times
    const [rows] = await db.execute(
      `SELECT c.*, u.username, c.createAt 
       FROM contents c JOIN users u ON c.id_user = u.id_user`
    );

    // return the content with their corresponding usernames and creation times
    res.status(200).json(rows);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "An error occurred while fetching content" });
  }
};

const editContent = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req, res);
    const { id_content, caption } = req.body;
    let image = null;
    const { file } = req;
    if (file) {
      image = "/" + file.filename;
    }

    // fetch the current value of the image column from the database
    const [rows] = await db.execute(
      "SELECT image, id_user FROM contents WHERE id_content = ?",
      [id_content]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Content not found" });
    }
    const contentUserId = rows[0].id_user;
    const currentImage = rows[0].image;

    // check if the authenticated user is the owner of the content
    if (userId !== contentUserId) {
      return res
        .status(401)
        .json({ message: "You are not authorized to edit this content" });
    }

    // check if any of the parameters are undefined and replace them with null if necessary
    const params = [caption];
    if (image) {
      params.push(image);
    } else {
      params.push(currentImage);
    }
    params.push(id_content);

    // update content
    const [result] = await db.execute(
      "UPDATE contents SET caption = ?, image = ? WHERE id_content = ?",
      params
    );

    // check if any rows were affected by the update query
    if (result.affectedRows === 0) {
      throw new Error("Content not found");
    }

    res.status(200).json({ message: "Content updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message });
  }
};

const deleteContent = async (req, res) => {
  try {
    const id_content = req.params.id;
    const userId = getUserIdFromToken(req, res);

    // check if the content exists and belongs to the user
    const [[content]] = await db.execute(
      "SELECT * FROM contents WHERE id_content = ? AND id_user = ?",
      [id_content, userId]
    );
    if (!content) {
      return res.status(404).json({ message: "Content not found" });
    }

    // delete the content
    await db.execute("DELETE FROM contents WHERE id_content = ?", [id_content]);

    res.status(200).json({ message: "Content deleted successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "An error occurred while deleting content" });
  }
};

const likeContent = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req, res);
    const contentId = req.params.id; // id of the content being liked
    const userContentId = req.body.id_user; // id of the user who created the content

    // check if the content exists
    const [rows] = await db.execute(
      "SELECT * FROM contents WHERE id_content = ?",
      [contentId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Content not found" });
    }

    // check if the user has already liked the content
    const [likes] = await db.execute(
      "SELECT * FROM contentlikes WHERE id_user = ? AND id_content = ?",
      [userId, contentId]
    );
    if (likes.length > 0) {
      return res
        .status(400)
        .json({ message: "You have already liked this content" });
    }

    // check if the provided userContentId matches the actual owner of the content
    const [contentOwner] = await db.execute(
      "SELECT id_user FROM contents WHERE id_content = ?",
      [contentId]
    );
    if (
      contentOwner.length === 0 ||
      contentOwner[0].id_user !== userContentId
    ) {
      return res.status(400).json({ message: "Invalid userContentId" });
    }

    // insert a new row into the contentlikes table
    await db.execute(
      "INSERT INTO contentlikes (id_user, id_content, id_user_content) VALUES (?, ?, ?)",
      [userId, contentId, userContentId || null]
    );

    res.status(201).json({ message: "Content liked successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "An error occurred while liking the content" });
  }
};

const createComment = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req, res);
    const contentId = req.params.id; // id of the content being commented on
    const { comment } = req.body;

    // check if the content exists
    const [rows] = await db.execute(
      "SELECT * FROM contents WHERE id_content = ?",
      [contentId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Content not found" });
    }

    // insert a new row into the comments table
    await db.execute(
      "INSERT INTO comments (id_user, id_content, comment) VALUES (?, ?, ?)",
      [userId, contentId, comment]
    );

    res.status(201).json({ message: "Comment created successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "An error occurred while creating the comment" });
  }
};

module.exports = {
  addContent,
  showAllContent,
  editContent,
  deleteContent,
  likeContent,
  createComment,
};
