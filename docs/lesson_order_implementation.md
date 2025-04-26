# Lesson Order Implementation Guide

This guide explains how to implement and use the lesson order mapping system for digital games.

## Overview

The system allows users to:
1. Select lessons for a digital game
2. Reorder lessons using drag-and-drop
3. Save the custom order for future reference
4. Display lessons in the specified order

## Database Setup

1. Run the SQL script in `scripts/create_lesson_order_table.sql` in your Supabase SQL editor to create the necessary table and permissions.

```sql
-- Create the lesson_order_mappings table
CREATE TABLE IF NOT EXISTS public.lesson_order_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mapping JSONB NOT NULL DEFAULT '{}'::JSONB
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS lesson_order_mappings_user_id_idx ON public.lesson_order_mappings (user_id);

-- Set up Row Level Security (RLS)
ALTER TABLE public.lesson_order_mappings ENABLE ROW LEVEL SECURITY;

-- Create policies for security
CREATE POLICY lesson_order_mappings_select_policy 
  ON public.lesson_order_mappings 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Create more policies as needed for insert, update, delete
```

## Files Created/Modified

1. **utils/lessonOrderUtils.ts**: Utility functions for managing lesson order mappings
2. **components/LessonOrderManager.tsx**: Drag-and-drop component for reordering lessons
3. **app/digital-games/page.tsx**: Updated to use the new components and utilities
4. **utils/translations.ts**: Added translation keys for the new UI elements
5. **types/supabase.ts**: Added TypeScript definitions for the new table

## Usage

### Loading the Lesson Order Mapping

```typescript
// In your component or page:
const [lessonOrderMapping, setLessonOrderMapping] = useState<Record<string, number>>({});

// In your data loading function:
const { data: { user } } = await supabaseClient.auth.getUser();
if (user) {
  const mapping = await getLessonOrderMapping(supabaseClient, user.id);
  setLessonOrderMapping(mapping);
}
```

### Displaying Lessons in Order

```typescript
// Function to sort lessons by their order
const getSortedLessonIds = (lessonIds: string[]) => {
  if (!lessonIds?.length) return [];
  
  return [...lessonIds].sort((a, b) => {
    const orderA = lessonOrderMapping[a] || getLessonNumber(a);
    const orderB = lessonOrderMapping[b] || getLessonNumber(b);
    return orderA - orderB;
  });
};

// In your JSX:
{getSortedLessonIds(game.lesson_ids).map(lessonId => {
  const lesson = lessons.find(l => l.id === lessonId);
  const lessonNumber = lessonOrderMapping[lessonId] || getLessonNumber(lessonId);
  return lesson ? (
    <Badge key={lessonId} variant="outline" className="text-xs">
      {lessonNumber > 0 ? `${lessonNumber}. ` : ''}{lesson.title}
    </Badge>
  ) : null;
})}
```

### Updating the Lesson Order

```typescript
// Handle lesson reordering
const handleLessonReorder = async (reorderedLessons: string[]) => {
  // Update local state
  setSelectedLessons(reorderedLessons);
  
  // Create a new mapping based on the order
  const newMapping = createMappingFromOrder(reorderedLessons);
  setLessonOrderMapping(prev => ({...prev, ...newMapping}));
  
  // Save to database
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (user) {
    await updateLessonOrderMapping(supabaseClient, user.id, {
      ...lessonOrderMapping,
      ...newMapping
    });
  }
};
```

## Default Mapping Fallback

If a user doesn't have a custom mapping, the system falls back to a default mapping defined in `lib/utils.ts`:

```typescript
// Add a mapping function to get lesson numbers from UUIDs
export const getLessonNumber = (lessonId: string): number => {
  const lessonMap: {[key: string]: number} = {
    "a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b6c": 1,
    "b2c3d4e5-f6a7-58b9-ac0d-2e3f4a5b6c7d": 2,
    "c3d4e5f6-a7b8-69ca-bd1e-3f4a5b6c7d8e": 3,
    "d4e5f6a7-b8c9-7adb-ce2f-4a5b6c7d8e9f": 4,
    "e5f6a7b8-c9da-8bec-df3a-5b6c7d8e9f0a": 5
  };
  return lessonMap[lessonId] || 0;
};
``` 