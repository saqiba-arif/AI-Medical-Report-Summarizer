---
title: AI Medical Report Summarizer
emoji: 🏥
colorFrom: blue
colorTo: indigo
sdk: static
pinned: false
---

# 🏥 AI Medical Report Summarizer

An intelligent medical report analyzer powered by Google's Gemini AI. Upload medical reports (PDF, images, text files) and get instant AI-generated summaries with key findings, risk alerts, and recommendations.

![Medical Report Summarizer](hero-image.jpg)

## ✨ Features

- **📄 Report Upload** — Supports PDF, Images (PNG, JPG, WebP), and Text files
- **🤖 AI-Powered Analysis** — Uses Google Gemini AI for accurate medical report summarization
- **💬 Interactive Chatbot** — Ask follow-up questions about your report
- **🔐 User Authentication** — Secure login/signup with Firebase
- **📱 Responsive Design** — Works seamlessly on desktop and mobile
- **🎨 Modern UI** — Premium glassmorphism design with smooth animations

## 🚀 Live Demo

> _Coming soon..._

## 🛠️ Tech Stack

| Technology | Purpose |
|-----------|---------|
| **HTML5** | Structure & Semantics |
| **CSS3** | Styling, Animations, Glassmorphism |
| **JavaScript** | Logic & API Integration |
| **Google Gemini AI** | Medical Report Analysis |
| **Firebase** | Authentication & User Management |

## 📋 Setup Instructions

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/ai-medical-report-summarizer.git
cd ai-medical-report-summarizer
```

### 2. Get a Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Create a free API key
3. Open `ai-service.js` and replace the placeholder:
```javascript
const API_KEY = "PASTE_YOUR_GEMINI_API_KEY_HERE";
```

### 3. Firebase Setup
1. Create a project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Email/Password Authentication
3. Update `firebase.js` with your Firebase config

### 4. Run Locally
Simply open `index.html` in your browser, or use a local server:
```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .
```

## 📁 Project Structure

```
AI Medical Report Summarizer/
├── index.html          # Landing page
├── login.html          # Login page
├── signup.html         # Signup page
├── dashboard.html      # Main dashboard with report analyzer
├── style.css           # Landing page styles
├── dashboard.css       # Dashboard styles
├── auth.css            # Authentication page styles
├── script.js           # Landing page scripts
├── dashboard.js        # Dashboard logic & chatbot
├── ai-service.js       # Gemini AI integration
├── firebase.js         # Firebase configuration
├── auth.js             # Authentication logic
└── README.md           # This file
```

## 🔒 Security Note

> **⚠️ Important:** Never commit your API keys to the repository. The `ai-service.js` file in this repo uses a placeholder key. Replace it with your own key locally.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## 👤 Author

**Your Name**

- GitHub: [@your-username](https://github.com/your-username)

---

⭐ **Star this repo if you found it useful!**
