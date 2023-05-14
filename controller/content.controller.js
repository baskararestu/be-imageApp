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
    const { id_content, caption } = req.body;
    let image = "";
    const { file } = req;
    if (file) {
      image = "/" + file.filename;
    }

    // check if any of the parameters are undefined and replace them with null if necessary
    const params = [caption, image, id_content];
    for (let i = 0; i < params.length; i++) {
      if (typeof params[i] === "undefined") {
        params[i] = null;
      }
    }

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

module.exports = {
  addContent,
  showAllContent,
  editContent,
  deleteContent,
};
