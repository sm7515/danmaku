const express = require('express');
const mongooseModel = require('mongoose').model;
const _ = require('lodash');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const port = process.env.PORT || 3000;
require('./server/db');

app.use('/public', express.static(_.join([__dirname, 'public'], '/')));
app.get('/', (req, res) => {
  res.sendFile(_.join([__dirname, 'index.html'], '/'));
});

app.post('/', (req, res) => {
  const { content } = req.body;
  const Post = mongooseModel('Post');
  const newPost = new Post({ content });

  newPost.save((err) => {
    if (err) res.sendStatus(500);
    else res.sendStatus(200);
  });
});

app.get('/messages', (req, res) => {
  const Post = mongooseModel('Post');
  Post.find({}, (err, docs) => {
    if (err) res.sendStatus(500);
    else {
      const posts = docs.map((ele) => ({
        data: ele.content,
        date: ele.createdAt,
      }));
      res.json(posts);
    }
  });
});

app.listen(port, () => console.log('listening on port: ' + port));
