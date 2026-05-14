import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataFile = path.join(rootDir, 'demo-shared-data.json');
const port = 3101;

const defaultData = {
  posts: [
    {
      id: 'demo-1',
      userId: 'demo-system',
      authorName: 'HonestLink Demo',
      authorPhoto: 'https://api.dicebear.com/9.x/shapes/svg?seed=HonestLink',
      content: 'Welcome to shared demo mode. Is device se jo post hoga, woh dusre local users ko bhi dikh sakta hai.',
      type: 'tip',
      likesCount: 0,
      dislikesCount: 0,
      createdAt: Date.now() - 1000 * 60 * 12,
      comments: [],
      likedByUserIds: [],
      dislikedByUserIds: [],
    },
    {
      id: 'demo-2',
      userId: 'demo-system',
      authorName: 'Career Survivor',
      authorPhoto: 'https://api.dicebear.com/9.x/shapes/svg?seed=CareerSurvivor',
      content: 'Interview process 5 rounds ka tha, feedback zero mila. Isi liye transparency zaroori hai.',
      type: 'interview',
      likesCount: 0,
      dislikesCount: 0,
      createdAt: Date.now() - 1000 * 60 * 55,
      comments: [],
      likedByUserIds: [],
      dislikedByUserIds: [],
    },
  ],
};

const ensureDataFile = () => {
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(defaultData, null, 2), 'utf8');
  }
};

const readData = () => {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
};

const writeData = (data) => {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8');
};

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get('/api/demo/posts', (_req, res) => {
  const data = readData();
  const posts = [...data.posts].sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  res.json({ posts });
});

app.post('/api/demo/posts', (req, res) => {
  const { userId, authorName, authorPhoto, content, type } = req.body ?? {};
  if (!userId || !content || !type) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const data = readData();
  const post = {
    id: `demo-${Date.now()}`,
    userId,
    authorName: authorName || 'Demo User',
    authorPhoto: authorPhoto || defaultData.posts[0].authorPhoto,
    content,
    type,
    likesCount: 0,
    dislikesCount: 0,
    createdAt: Date.now(),
    comments: [],
    likedByUserIds: [],
    dislikedByUserIds: [],
  };
  data.posts.unshift(post);
  writeData(data);
  res.json({ post, posts: data.posts });
});

app.post('/api/demo/posts/:postId/like', (req, res) => {
  const { postId } = req.params;
  const { userId } = req.body ?? {};
  const data = readData();
  const post = data.posts.find((item) => item.id === postId);

  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  post.likedByUserIds = Array.isArray(post.likedByUserIds) ? post.likedByUserIds : [];
  post.dislikedByUserIds = Array.isArray(post.dislikedByUserIds) ? post.dislikedByUserIds : [];
  if (userId) {
    if (post.likedByUserIds.includes(userId)) {
      post.likedByUserIds = post.likedByUserIds.filter((id) => id !== userId);
    } else {
      post.dislikedByUserIds = post.dislikedByUserIds.filter((id) => id !== userId);
      post.likedByUserIds.push(userId);
    }
    post.likesCount = post.likedByUserIds.length;
    post.dislikesCount = post.dislikedByUserIds.length;
    writeData(data);
  }

  res.json({ post, posts: data.posts });
});

app.post('/api/demo/posts/:postId/dislike', (req, res) => {
  const { postId } = req.params;
  const { userId } = req.body ?? {};
  const data = readData();
  const post = data.posts.find((item) => item.id === postId);

  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  post.likedByUserIds = Array.isArray(post.likedByUserIds) ? post.likedByUserIds : [];
  post.dislikedByUserIds = Array.isArray(post.dislikedByUserIds) ? post.dislikedByUserIds : [];
  if (userId) {
    if (post.dislikedByUserIds.includes(userId)) {
      post.dislikedByUserIds = post.dislikedByUserIds.filter((id) => id !== userId);
    } else {
      post.likedByUserIds = post.likedByUserIds.filter((id) => id !== userId);
      post.dislikedByUserIds.push(userId);
    }
    post.likesCount = post.likedByUserIds.length;
    post.dislikesCount = post.dislikedByUserIds.length;
    writeData(data);
  }

  res.json({ post, posts: data.posts });
});

app.post('/api/demo/posts/:postId/comments', (req, res) => {
  const { postId } = req.params;
  const { userName, text, parentCommentId } = req.body ?? {};
  const data = readData();
  const post = data.posts.find((item) => item.id === postId);

  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  const comment = {
    id: `comment-${Date.now()}`,
    userName: userName || 'Anonymous User',
    text,
    createdAt: Date.now(),
    replies: [],
  };

  post.comments = Array.isArray(post.comments) ? post.comments : [];
  if (parentCommentId) {
    post.comments = post.comments.map((item) =>
      item.id === parentCommentId
        ? {
            ...item,
            replies: [
              ...(Array.isArray(item.replies) ? item.replies : []),
              {
                id: `reply-${Date.now()}`,
                userName: userName || 'Anonymous User',
                text,
                createdAt: Date.now(),
              },
            ],
          }
        : item
    );
  } else {
    post.comments.push(comment);
  }
  writeData(data);
  res.json({ post, posts: data.posts });
});

app.post('/api/demo/reset', (_req, res) => {
  writeData(defaultData);
  res.json({ posts: defaultData.posts });
});

ensureDataFile();
app.listen(port, '0.0.0.0', () => {
  console.log(`Shared demo API running on http://0.0.0.0:${port}`);
});
