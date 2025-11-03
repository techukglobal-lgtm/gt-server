// const mongoose = require('mongoose');

// // Define the schema
// const BlogSchema = new mongoose.Schema({
//   title: {
//     type: String,
//     required: [true, 'Blog title is required'],
//     trim: true
//   },
//   description: {
//     type: String,
//     required: [true, 'Blog description is required'],
//     trim: true
//   },
//   media: {
//     type: {
//       type: String,
//       required: [true, 'Media type is required']
//     },
//     url: {
//       type: String,
//       required: [true, 'Media URL is required']
//     }
//   },
//   // author: {
//   //   type: mongoose.Schema.Types.ObjectId,
//   //   ref: 'User',
//   //   required: [true, 'Author is required']
//   // },
//   createdAt: {
//     type: Date,
//     default: Date.now
//   }
// });

// // Create the model from the schema
// const Blog = mongoose.model('Blog', BlogSchema);

// module.exports = Blog;