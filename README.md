<div align="center">
  <img src="public/icons.svg" alt="SnapHub Logo" width="80" height="80" />
  
  # SnapHub.id
  **Premium Photobooth Services in Malang, Indonesia**

  <p>
    <a href="https://snaphub.my.id">View Live Demo</a> ·
    <a href="https://wa.me/6285190643459">Contact Us</a>
  </p>
</div>

---

## 📸 About The Project

SnapHub is a modern, ultra-fast, and responsive web application built for a premium photobooth service based in Malang. Designed with a sleek "dark-glassmorphism" aesthetic, it provides users with an engaging experience to explore features, view dynamic pricing, check real-time availability, and calculate revenue sharing for partnership events.

### 🌟 Key Features

- **Modern UI/UX:** Built with a beautiful dark mode glassmorphism design, vibrant red accents, and highly optimized micro-animations using Framer Motion.
- **Booking & Availability Calendar:** Integrated with Supabase, users can view real-time booked dates and availability via an interactive calendar.
- **Admin Dashboard:** A secured backend dashboard for administrators to manage schedules, track booked dates, and monitor financial events seamlessly.
- **Dynamic Profit Calculator:** A dedicated revenue-sharing calculator for "Event Fun Snap" partners, featuring interactive charts (Recharts) to visualize revenue distribution.
- **Performance Optimized:** Uses native `.webp` image formatting for rapid load times and highly optimized Framer Motion `useMotionValue` for 60FPS mouse-glow tracking effects.
- **Pricelist & PDF Integration:** Clear pricing structures with direct access to download the official PDF Price Guide.
- **Floating WhatsApp:** Persistent quick-access floating button for seamless customer communication.

## 🛠 Built With

This project utilizes a modern frontend and backend stack:

- [React.js 19](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/) (UI Animations & Micro-interactions)
- [Supabase](https://supabase.com/) (Backend-as-a-Service, Database & Auth)
- [Recharts](https://recharts.org/) (Data Visualization)
- [React Calendar](https://github.com/wojtekmaj/react-calendar) (Booking system)

## 🚀 Getting Started

Follow these instructions to set up the project locally on your machine.

### Prerequisites

- Node.js (v18.x or higher recommended)
- npm or yarn
- A Supabase Project (for database credentials)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/lohkookk/SnapHub.id.git
   ```
2. Navigate to the project directory:
   ```bash
   cd SnapHub.id
   ```
3. Install the dependencies:
   ```bash
   npm install
   ```
4. Set up environment variables:
   Create a `.env` file in the root directory and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
5. Start the development server:
   ```bash
   npm run dev
   ```
6. Open your browser and visit `http://localhost:5173`.

## 📁 Project Structure

```text
src/
├── assets/         # Static assets (.webp optimized images, icons)
├── components/     # Reusable React components (Navbar, Hero, BookingCalendar, etc.)
├── pages/          # Main page assemblies (Home.jsx, Admin.jsx)
├── lib/            # Configuration files (Supabase client)
├── index.css       # Global CSS and Tailwind configurations
├── App.jsx         # Main application layout and routing
└── main.jsx        # Entry point
public/
└── PriceGuideSnapHub.id.pdf  # Downloadable price guide
```

## 🌐 Deployment

This project is optimized for deployment on [Vercel](https://vercel.com). Because it uses Vite, the build command is `npm run build` and the output directory is `dist`. Ensure you add your Supabase Environment Variables to your Vercel project settings.

Live Deployment URL: [snaphub.my.id](https://snaphub.my.id)

## 📞 Contact

**SnapHub.id**
- Location: Malang, Jawa Timur, Indonesia
- WhatsApp: [+62 851-9064-3459](https://wa.me/6285190643459)
- Instagram: [@snaphub.id](https://instagram.com/snaphub.id)

---
*Made with ♥ by Puja Rajistha.*
