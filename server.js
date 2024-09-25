const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const app = express();
const multer = require('multer');




//multer
// Set up storage engine for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');  // Save files to this directory
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));  // Create a unique filename
  }
});

const upload = multer({ storage: storage });

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 5 * 60 * 1000 } // Session expires after 5 minutes
}));

// MongoDB connection
mongoose.connect('mongodb+srv://hamzadua12:Hamzajeee@cluster0.dfcs2.mongodb.net/myfirstdatabase', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('Connected to MongoDB');
})
.catch((err) => {
  console.error('Error connecting to MongoDB:', err);
});

// Define Schemas and Models
const studentSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const Student = mongoose.model('Student', studentSchema);

const blogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  comments: [{
    comment: String,
    commenter: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' }
  }],
  image: { type: String },  // Store image file path
  createdAt: { type: Date, default: Date.now }
});

const Blog = mongoose.model('Blog', blogSchema);

// Middleware for checking authentication
const checkAuth = (req, res, next) => {
  if (req.session.loggedIn) {
    next();
  } else {
    res.redirect('/login');
  }
};

// Routes
// Home route - serve signup page
app.get('/', (req, res) => {
  if (req.session.loggedIn) {
    return res.redirect('/blogs'); // Redirect to welcome page if logged in
  }
  res.sendFile(path.join(__dirname, 'views/signup.html')); // Serve signup.html
});

// Signup route
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;

  // Basic email validation
  if (!/\S+@\S+\.\S+/.test(email)) {
    return res.send('Invalid email format');
  }
  
  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Create new student
  const newStudent = new Student({ email, password: hashedPassword });
  
  try {
    await newStudent.save(); // Save to database
    res.send('Student registered!');
  } catch (err) {
    res.send('Error registering student: ' + err.message);
  }
});

// Login route
app.get('/login', (req, res) => {
  if (req.session.loggedIn) {
    return res.redirect('/blogs');  // Redirect to welcome page if logged in
  }
  res.sendFile(path.join(__dirname, 'views/login.html')); // Serve login.html
});

// Login form submission
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Basic email validation
  if (!/\S+@\S+\.\S+/.test(email)) {
    return res.send('Invalid email format');
  }
  
  const student = await Student.findOne({ email });
  
  if (!student) {
    return res.send('No student found with that email');
  }
  
  // Compare hashed password
  const isMatch = await bcrypt.compare(password, student.password);
  
  if (isMatch) {
    req.session.loggedIn = true;
    req.session.studentId = student._id; // Store student ID in session
    req.session.email = email;  // Store email in session
    res.redirect('/blogs');  // Redirect to welcome page
  } else {
    res.send('Invalid credentials');
  }
});

// Welcome page after login
app.get('/welcome', checkAuth, (req, res) => {
  res.send('Welcome, ' + req.session.email); // Display welcome message
});

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.send('Error logging out');
    }
    res.redirect('/login');
  });
});

// Serve blogs page
app.get('/blogs', checkAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views/blogs.html')); // Serve blogs.html
});

// API to fetch blogs data
app.get('/api/blogs', checkAuth, async (req, res) => {
  try {
    const blogs = await Blog.find().populate('author').populate('comments.commenter');
    res.json(blogs);  // Send blogs as JSON
  } catch (err) {
    res.status(500).send('Error fetching blogs: ' + err.message);
  }
});

// Add a new blog

app.post('/add-blog', checkAuth, upload.single('image'), async (req, res) => {
  const { title, content } = req.body;
  const newBlog = new Blog({
    title,
    content,
    author: req.session.studentId,
    image: req.file ? `/uploads/${req.file.filename}` : null  // Save the image path
  });

  try {
    await newBlog.save();
    res.redirect('/blogs');
  } catch (err) {
    res.send('Error creating blog: ' + err.message);
  }
});


// Like a blog
app.post('/like-blog/:id', checkAuth, async (req, res) => {
  const blogId = req.params.id;
  const blog = await Blog.findById(blogId);

  if (!blog.likes.includes(req.session.studentId)) {
    blog.likes.push(req.session.studentId); // Add user to likes
    await blog.save();
  }
  res.redirect('/blogs');
});

// Comment on a blog
app.post('/comment-blog/:id', checkAuth, async (req, res) => {
  const { comment } = req.body;
  const blogId = req.params.id;
  const blog = await Blog.findById(blogId);

  blog.comments.push({ comment, commenter: req.session.studentId });
  await blog.save();
  
  res.redirect('/blogs');
});

// Start the server
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
