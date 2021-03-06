require('dotenv').config();
const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  content: String,
  createdAt: { type: Date, default: Date.now },
});
mongoose.model('Post', postSchema);

const uri = process.env.mongoURI;
mongoose.connect(
  uri,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true,
    dbName: 'danmaku',
  },
  (err) => {
    if (err) console.log(err);
    else console.log('database connected');
  },
);
