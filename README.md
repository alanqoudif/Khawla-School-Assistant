# Unified Admissions Assistant - Khawla School

A modern web application built with Next.js that serves as an admissions assistant for Khawla School. The application provides an interactive chat interface to help prospective students and parents with admissions-related questions and guidance.

## Description

This project is a comprehensive admissions assistant that leverages AI-powered chat functionality to provide personalized guidance for school admissions. The application features a clean, modern UI built with React, TypeScript, and Tailwind CSS, offering an intuitive user experience for navigating the admissions process.

Key features include:
- Interactive chat interface for admissions guidance
- Admin panel for managing content and settings
- Responsive design optimized for all devices
- Modern UI components built with Radix UI
- AI-powered content generation and assistance

## How to Run

### Running the Next.js Application

To run the main application:

```bash
# Install dependencies
npm install
# or
pnpm install

# Start the development server
npm run dev
# or
pnpm dev
```

The application will be available at `http://localhost:3000`.

### Running the Python Script

To run the main Python script:

```bash
python main.py
```

## How to Test

### Testing the Next.js Application

To run the application tests:

```bash
# Run linting
npm run lint
# or
pnpm lint

# Build the application (tests the build process)
npm run build
# or
pnpm build
```

### Testing the Python Script

To run the Python tests:

```bash
pytest test_main.py
```

## Project Structure

- `app/` - Next.js app router pages and API routes
- `components/` - Reusable React components
- `lib/` - Utility functions and configurations
- `public/` - Static assets and images
- `styles/` - Global CSS styles
- `utils/` - Helper functions and utilities

## Technologies Used

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, Radix UI components
- **AI Integration**: OpenAI API
- **Deployment**: Netlify
- **Package Manager**: npm/pnpm

## Getting Started

1. Clone the repository
2. Install dependencies using `npm install` or `pnpm install`
3. Set up environment variables (if required)
4. Run the development server with `npm run dev` or `pnpm dev`
5. Open `http://localhost:3000` in your browser

## Contributing

Please ensure all code follows the project's coding standards and includes appropriate tests before submitting pull requests.