# MindAiTutor

A comprehensive educational platform built with Next.js, enabling personalized learning experiences through AI-powered tutoring and digital lesson management.

## Overview

Mind AI Tutor is an interactive learning platform that helps educators create, organize, and deliver digital lessons while providing students with AI-assisted learning experiences. The platform features user authentication, lesson management, digital games, AI quizzes, and interactive activities.

## Core Features

- **User Authentication**: Secure login, registration, and profile management
- **Digital Games**: Interactive learning experiences with customizable lesson sequences
- **Lesson Management**: Create, edit, and organize educational content
- **Custom Lesson Ordering**: Drag-and-drop interface for reordering lessons within a game
- **AI-Powered Quizzes**: Generate and take quizzes with AI assistance
- **Student Management**: Track student progress and activities
- **Reporting**: Generate detailed reports on student performance
- **Multi-language Support**: Internationalization capabilities

## Technologies

- **Frontend**: Next.js, React, Tailwind CSS, Radix UI
- **Backend**: Supabase for authentication and database
- **AI Integration**: Google Generative AI
- **State Management**: React Context API, React Query
- **Data Visualization**: Chart.js, Recharts
- **Document Generation**: PDF, DOCX, PPTX, Excel exports

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone [repository-url]

# Navigate to project directory
cd mind-ai-tutor

# Install dependencies
npm install
# or
yarn install

# Set up environment variables
# Create a .env.local file based on .env.example
```

### Development

```bash
# Start the development server
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Database Setup

To use the lesson ordering functionality, run the following SQL script in your Supabase SQL editor:

```sql
-- Execute the script in scripts/create_lesson_order_table.sql
```

Alternatively, you can directly run the contents of `scripts/create_lesson_order_table.sql` file.

## Deployment

The application is configured for deployment on Vercel:

```bash
# Build the application
npm run build
# or
yarn build

# Start the production server
npm run start
# or
yarn start
```

## Troubleshooting

If you encounter the following error:

```
Error: Error fetching lesson order mapping: {}
```

This indicates that the `lesson_order_mappings` table has not been created in your Supabase database. Run the SQL script mentioned in the Database Setup section.

## License

[Your license information here]
