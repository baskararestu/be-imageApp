const jwt = require("jsonwebtoken");

// getUserIdFromToken is a helper function to get user id from token and if token is not valid, it will return 401 status code
const getUserIdFromToken = (req, resp) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    resp.status(401).json({
      message: "Unauthorized",
    });
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  console.log(decoded, "ini decoded helper");
  return decoded?.id;
};

module.exports = { getUserIdFromToken };
