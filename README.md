# 📸 Photo Check - Random Photo Reminder App

A Progressive Web App (PWA) that sends random photo reminders to users, giving them 5 minutes to capture and upload a photo. Built with React, TypeScript, Tailwind CSS, and Supabase.

## ✨ Features

- **Random Photo Reminders**: Get unexpected notifications to capture life's moments
- **5-Minute Time Limit**: Urgent, time-sensitive photo challenges
- **Mobile-First Design**: Optimized for mobile devices with camera integration
- **Real-time Notifications**: Browser notifications with action buttons
- **Photo Storage**: Secure cloud storage with Supabase
- **User Authentication**: Secure signup/login with email verification
- **Photo History**: View all your captured moments

## 🚀 Tech Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase (Database + Storage + Auth)
- **Routing**: React Router v6
- **Build Tool**: Vite
- **PWA Features**: Service Worker + Notifications

## 📱 Mobile Features

- Camera access (back camera preferred)
- Touch-friendly interface
- Responsive design
- Offline capability
- Push notifications

## 🗄️ Database Schema

The app uses three main tables:

1. **users** - User profiles and notification preferences
2. **reminders** - Scheduled photo reminders with status tracking
3. **photos** - Uploaded photos linked to reminders

## 🛠️ Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Modern browser with camera support

### 1. Clone and Install

```bash
git clone <your-repo>
cd photo_check
npm install
```

### 2. Supabase Setup

1. Create a new Supabase project
2. Go to Settings > API to get your project URL and anon key
3. Create a storage bucket named `photos`
4. Run the SQL schema from `database_schema.sql` in the SQL Editor

### 3. Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Storage Bucket Setup

In your Supabase dashboard:
1. Go to Storage > Buckets
2. Create a new bucket named `photos`
3. Set it to public (or configure RLS policies)
4. Update storage policies for photo uploads

### 5. Run the App

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

## 📋 Database Setup

Run the following SQL in your Supabase SQL Editor:

```sql
-- Create users table
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    notification_preferences JSONB DEFAULT '{"enabled": true, "frequency": "random"}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reminders table
CREATE TABLE public.reminders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT CHECK (status IN ('pending', 'active', 'completed', 'expired')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create photos table
CREATE TABLE public.photos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    reminder_id UUID REFERENCES public.reminders(id) ON DELETE CASCADE NOT NULL,
    photo_url TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS and create policies
-- (See database_schema.sql for complete setup)
```

## 🔧 Configuration

### Notification Settings

Users can configure:
- Notification frequency (daily, weekly, random)
- Time windows for reminders
- Enable/disable notifications

### Storage Policies

Ensure your Supabase storage bucket allows authenticated users to upload photos:

```sql
-- Allow authenticated users to upload photos
CREATE POLICY "Users can upload photos" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'photos' AND auth.role() = 'authenticated');

-- Allow users to view their own photos
CREATE POLICY "Users can view own photos" ON storage.objects
    FOR SELECT USING (bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]);
```

## 📱 PWA Features

The app includes:
- Service worker for offline functionality
- App manifest for home screen installation
- Push notifications
- Camera integration
- Touch gestures

## 🚀 Deployment

### Build for Production

```bash
npm run build
```

### Deploy to Vercel/Netlify

1. Connect your repository
2. Set environment variables
3. Deploy automatically on push

### Environment Variables for Production

Ensure these are set in your deployment platform:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 🔒 Security Features

- Row Level Security (RLS) enabled
- User authentication required
- Photo access restricted to owners
- Secure file uploads
- JWT-based authentication

## 🧪 Testing

```bash
# Run tests
npm run test

# Run with coverage
npm run test:coverage
```

## 📝 API Endpoints

The app uses Supabase's auto-generated APIs:
- `POST /rest/v1/reminders` - Create reminder
- `GET /rest/v1/reminders` - Get user reminders
- `PUT /rest/v1/reminders` - Update reminder status
- `POST /storage/v1/object/photos` - Upload photo

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
1. Check the Supabase documentation
2. Review browser console for errors
3. Ensure camera permissions are granted
4. Verify environment variables are set correctly

## 🔮 Future Enhancements

- [ ] Photo filters and editing
- [ ] Social sharing features
- [ ] Photo challenges and themes
- [ ] Analytics dashboard
- [ ] Mobile app versions
- [ ] Advanced scheduling options
- [ ] Photo albums and collections
