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
const contentByIdUser = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req, res);

    // get content by user id
    const [rows] = await db.execute(
      `SELECT c.*, u.username, u.fullname,c.createAt 
       FROM contents c JOIN users u ON c.id_user = u.id_user
       WHERE c.id_user = ?`,
      [userId]
    );

    // return the content with their corresponding usernames and creation times
    res.status(200).json(rows);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "An error occurred while fetching content by user" });
  }
};

const infiniteScrollContent = async (req, res) => {
  try {
    // Query to get all content with their corresponding usernames, creation times, comments, and number of likes
    const query = `
      SELECT c.*, u.username, c.createAt, COUNT(l.id_contentLikes) AS likes
      FROM contents c
      JOIN users u ON c.id_user = u.id_user
      LEFT JOIN contentLikes l ON c.id_content = l.id_content
      GROUP BY c.id_content
      ORDER BY c.id_content ASC
    `;

    // Execute the query
    const [rows] = await db.execute(query);

    // Fetch comments for each content separately
    for (const item of rows) {
      const commentQuery = `
        SELECT com.comment, u.username
        FROM comments com JOIN users u ON com.id_user = u.id_user
        WHERE com.id_content = ${item.id_content}
        ORDER BY com.created_At DESC
      `;
      const [commentRows] = await db.execute(commentQuery);
      item.comments = commentRows;
    }

    res.status(200).json({ content: rows });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "An error occurred while fetching content" });
  }
};

const getContentById = async (req, res) => {
  try {
    const { id_content } = req.params;

    // Query the database to get the content by id and include the username and full name
    const [rows] = await db.execute(
      `SELECT c.*, u.username, u.fullname 
       FROM contents c 
       JOIN users u ON c.id_user = u.id_user 
       WHERE c.id_content = ?`,
      [id_content]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Content not found" });
    }

    // Extract the first row (since id_content is unique) and return the content
    const content = rows[0];

    res.status(200).json(content);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "An error occurred while fetching content by ID" });
  }
};

const editContent = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const { caption } = req.body;
    const { id } = req.params; // Get the id from the route parameter

    // fetch the current value of the id_user column from the database
    const [rows] = await db.execute(
      "SELECT id_user FROM contents WHERE id_content = ?",
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Content not found" });
    }
    const contentUserId = rows[0].id_user;

    // check if the authenticated user is the owner of the content
    if (userId !== contentUserId) {
      return res
        .status(401)
        .json({ message: "You are not authorized to edit this content" });
    }

    // update content
    const [result] = await db.execute(
      "UPDATE contents SET caption = ? WHERE id_content = ?",
      [caption, id]
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

    // Check if the content exists and belongs to the user
    const [[content]] = await db.execute(
      "SELECT * FROM contents WHERE id_content = ? AND id_user = ?",
      [id_content, userId]
    );
    if (!content) {
      return res.status(404).json({ message: "Content not found" });
    }

    // Delete associated contentLikes
    await db.execute("DELETE FROM contentLikes WHERE id_content = ?", [
      id_content,
    ]);

    // Delete associated comments
    await db.execute("DELETE FROM comments WHERE id_content = ?", [id_content]);

    // Delete the content
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

const getComments = async (req, res) => {
  try {
    const { id } = req.params;

    // retrieve the comments and usernames for the specific content id
    const [rows] = await db.execute(
      "SELECT comments.*, users.username FROM comments JOIN users ON comments.id_user = users.id_user WHERE comments.id_content = ?",
      [id]
    );

    res.status(200).json(rows);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message });
  }
};

const getLikes = async (req, res) => {
  try {
    const { id } = req.params;

    // retrieve the number of likes for the specific content id
    const [rows] = await db.execute(
      "SELECT COUNT(*) as num_likes FROM contentLikes WHERE id_content = ?",
      [id]
    );

    res.status(200).json(rows[0].num_likes);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  addContent,
  showAllContent,
  contentByIdUser,
  getContentById,
  infiniteScrollContent,
  editContent,
  deleteContent,
  likeContent,
  createComment,
  getComments,
  getLikes,
};
