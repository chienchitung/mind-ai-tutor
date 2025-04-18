'use client';

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/utils/translations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ModernDateRangePicker } from "@/components/ui/modern-date-range-picker";
import { DateRange } from "react-day-picker";
import { useToast } from "@/components/ui/use-toast";
import { 
  GraduationCap, 
  BookOpen, 
  MessageSquare, 
  Bell, 
  Award,
  Search,
  Filter,
  SlidersHorizontal,
  CheckCircle,
  Loader2
} from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { zhTW, enUS } from 'date-fns/locale';

// Define activity data types
interface Activity {
  id: string;
  title: string;
  description: string;
  type: 'student_progress' | 'course_update' | 'feedback' | 'reminder' | 'achievement';
  timestamp: string;
  source: 'lessons' | 'events' | 'feedback';
  read: boolean;
  target?: {
    id: string;
    name: string;
  };
}

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case 'student_progress':
      return (
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100">
          <GraduationCap className="h-5 w-5 text-black" />
        </div>
      );
    case 'course_update':
      return (
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100">
          <BookOpen className="h-5 w-5 text-green-500" />
        </div>
      );
    case 'feedback':
      return (
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-100">
          <MessageSquare className="h-5 w-5 text-purple-500" />
        </div>
      );
    case 'reminder':
      return (
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-100">
          <Bell className="h-5 w-5 text-orange-500" />
        </div>
      );
    case 'achievement':
      return (
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-yellow-100">
          <Award className="h-5 w-5 text-yellow-500" />
        </div>
      );
    default:
      return (
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100">
          <Bell className="h-5 w-5 text-gray-500" />
        </div>
      );
  }
}

function ActivityTypeBadge({ type, source }: { type: string; source: string }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  switch (type) {
    case 'student_progress':
      return <Badge variant="outline" className="bg-gray-50 text-black border-gray-200 text-xs py-1 px-2 rounded-md">Progress</Badge>;
    case 'course_update':
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs py-1 px-2 rounded-md">Update</Badge>;
    case 'feedback':
      return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs py-1 px-2 rounded-md">Feedback</Badge>;
    case 'reminder':
      return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs py-1 px-2 rounded-md">Reminder</Badge>;
    case 'achievement':
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs py-1 px-2 rounded-md">Achievement</Badge>;
    default:
      return <Badge variant="outline" className="text-xs py-1 px-2 rounded-md">{type}</Badge>;
  }
}

const formatTimeAgo = (date: Date, language: string) => {
  const locale = language === 'zh-TW' ? zhTW : enUS;
  return formatDistanceToNow(date, { 
    addSuffix: true,
    locale: locale 
  });
};

function ActivitiesPageContent() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const router = useRouter();
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [selectedActivityType, setSelectedActivityType] = useState("all");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Fetch activities from Supabase
  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setIsLoading(true);
        let allActivities: Activity[] = [];
        
        // 動態導入 supabase 函數
        const { supabase } = await import('@/lib/supabase');
        const supabaseClient = supabase();
        
        // 使用 as any 臨時解決類型問題
        const supabaseWithTypes = supabaseClient as any;
        
        // 1. Fetch lessons data and convert to activities
        try {
          const { data: lessonsData, error: lessonsError } = await supabaseWithTypes
            .from('lessons')
            .select('id, title, description, updated_at')
            .order('updated_at', { ascending: false });
            
          if (lessonsError) {
            console.error('Error fetching lessons:', lessonsError);
          } else if (lessonsData) {
            // Map lessons to activities
            const lessonActivities = lessonsData.map((lesson: any) => ({
              id: `lesson-${lesson.id}`,
              title: `Course updated: ${lesson.title}`,
              description: lesson.description || 'Course content has been updated',
              type: 'course_update' as const,
              timestamp: lesson.updated_at,
              source: 'lessons' as const,
              read: true,
              target: {
                id: lesson.id,
                name: lesson.title
              }
            }));
            allActivities = [...allActivities, ...lessonActivities];
          }
        } catch (err) {
          console.error('Error in lessons fetch:', err);
        }
        
        // 2. Fetch events data (reminders)
        try {
          const { data: eventsData, error: eventsError } = await supabaseWithTypes
            .from('events')
            .select('id, title, description, created_at, type')
            .order('created_at', { ascending: false });
            
          if (eventsError) {
            console.error('Error fetching events:', eventsError);
          } else if (eventsData) {
            // Map events to activities
            const eventActivities = eventsData.map((event: any) => ({
              id: `event-${event.id}`,
              title: event.title,
              description: event.description || 'Upcoming event reminder',
              type: 'reminder' as const,
              timestamp: event.created_at,
              source: 'events' as const,
              read: false,
              target: {
                id: event.id,
                name: event.title
              }
            }));
            allActivities = [...allActivities, ...eventActivities];
          }
        } catch (err) {
          console.error('Error in events fetch:', err);
        }
        
        // 3. Fetch feedback data
        try {
          const { data: feedbackData, error: feedbackError } = await supabaseWithTypes
            .from('feedback')
            .select('id, content, student_name, course, created_at, status')
            .order('created_at', { ascending: false });
            
          if (feedbackError) {
            console.error('Error fetching feedback:', feedbackError);
          } else if (feedbackData) {
            // Map feedback to activities
            const feedbackActivities = feedbackData.map((feedback: any) => ({
              id: `feedback-${feedback.id}`,
              title: `New feedback from ${feedback.student_name}`,
              description: `${feedback.course}: ${feedback.content.substring(0, 50)}${feedback.content.length > 50 ? '...' : ''}`,
              type: 'feedback' as const,
              timestamp: feedback.created_at,
              source: 'feedback' as const,
              read: feedback.status === 'responded',
              target: {
                id: feedback.id,
                name: feedback.student_name
              }
            }));
            allActivities = [...allActivities, ...feedbackActivities];
          }
        } catch (err) {
          console.error('Error in feedback fetch:', err);
        }
        
        // Check if we have any activities at all
        if (allActivities.length === 0) {
          console.warn('No activities data fetched from any source, using mock data');
          setActivities(getMockActivities());
        } else {
          // Sort all activities by timestamp
          allActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setActivities(allActivities);
          console.log(`Loaded ${allActivities.length} activities successfully`);
        }
      } catch (err) {
        console.error('Error in overall activities fetch:', err);
        setError('Failed to load activities data');
        // Use mock data as fallback
        setActivities(getMockActivities());
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchActivities();
  }, []);
  
  // Get mock activities for fallback
  const getMockActivities = (): Activity[] => {
    return [
      {
        id: 'lesson-1',
        title: 'Course updated: Excel Basics',
        description: 'New content added to Excel Basics course',
        type: 'course_update',
        timestamp: '2024-04-03T14:30:00.000Z',
        source: 'lessons',
        read: false,
        target: { id: '1', name: 'Excel Basics' }
      },
      {
        id: 'event-1',
        title: 'Assignment deadline approaching',
        description: 'JavaScript Introduction - Assignment due tomorrow',
        type: 'reminder',
        timestamp: '2024-04-02T10:15:00.000Z',
        source: 'events',
        read: true,
          target: { id: '2', name: 'JavaScript Introduction' }
        },
        {
        id: 'feedback-1',
        title: 'New feedback from John Smith',
        description: 'Data Analysis Course: The course is very clear, but I need more...',
          type: 'feedback',
        timestamp: '2024-04-01T09:45:00.000Z',
        source: 'feedback',
        read: false,
        target: { id: '3', name: 'John Smith' }
      },
      {
        id: 'lesson-2',
        title: 'Student completed: UI Design Basics',
        description: 'Sarah Lin completed UI Design Basics course',
        type: 'student_progress',
        timestamp: '2024-03-31T16:20:00.000Z',
        source: 'lessons',
        read: true,
        target: { id: '4', name: 'UI Design Basics' }
      },
      {
        id: 'event-2',
        title: 'Upcoming live session',
        description: 'React Advanced - Live coding session this Friday',
        type: 'reminder',
        timestamp: '2024-03-30T11:10:00.000Z',
        source: 'events',
        read: false,
        target: { id: '5', name: 'React Advanced' }
      }
    ];
  };
  
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };
  
  const handleTabChange = (value: string) => {
    setSelectedActivityType(value);
  };
  
  const handleMarkAllAsRead = () => {
    // In a real app, we would update the read status in the database
    setActivities(activities.map(activity => ({ ...activity, read: true })));
    toast({
      title: 'All activities marked as read',
      description: '',
      duration: 3000
    });
  };
  
  const handleActivityClick = (activity: Activity) => {
    // Mark as read
    setActivities(activities.map(a => 
      a.id === activity.id ? { ...a, read: true } : a
    ));
    
    // Navigate to sidebar main page based on source
    switch (activity.source) {
      case 'lessons':
        router.push(`/lessons`);
        break;
      case 'events':
        router.push(`/events`);
        break;
      case 'feedback':
        router.push(`/feedback`);
        break;
      default:
        router.push('/dashboard');
    }
  };
  
  // Filter and sort activities
  const filteredActivities = activities.filter(activity => {
    // Filter by search query
    const matchesSearch = searchQuery === "" || 
      activity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Filter by activity type
    const matchesType = selectedActivityType === "all" || 
      activity.type === selectedActivityType;
    
    // Filter by read status
    const matchesReadStatus = filterType === "all" || 
      (filterType === "read" && activity.read) || 
      (filterType === "unread" && !activity.read);
    
    // Filter by date range
    let matchesDateRange = true;
    if (selectedDateRange?.from) {
      const activityDate = new Date(activity.timestamp);
      const fromDate = new Date(selectedDateRange.from);
      fromDate.setHours(0, 0, 0, 0);
      
      if (selectedDateRange.to) {
        const toDate = new Date(selectedDateRange.to);
        toDate.setHours(23, 59, 59, 999);
        matchesDateRange = activityDate >= fromDate && activityDate <= toDate;
      } else {
        matchesDateRange = activityDate.getDate() === fromDate.getDate() &&
                           activityDate.getMonth() === fromDate.getMonth() &&
                           activityDate.getFullYear() === fromDate.getFullYear();
      }
    }
    
    return matchesSearch && matchesType && matchesReadStatus && matchesDateRange;
  }).sort((a, b) => {
    // Sort by timestamp (newest or oldest)
    const dateA = new Date(a.timestamp).getTime();
    const dateB = new Date(b.timestamp).getTime();
    return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
  });

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading activities...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight">Activity Feed</h1>
        <Button onClick={handleMarkAllAsRead} className="bg-black hover:bg-gray-800">
          <CheckCircle className="mr-2 h-4 w-4" />
          Mark All as Read
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="col-span-1">
          <ModernDateRangePicker
            value={selectedDateRange}
            onChange={setSelectedDateRange}
            className="w-full"
            placeholder="Select date range"
          />
        </div>
        <div className="col-span-1 md:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
              placeholder="Search activities..."
            value={searchQuery}
            onChange={handleSearch}
              className="w-full pl-10"
          />
          </div>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <Tabs defaultValue="all" onValueChange={handleTabChange} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="student_progress">Progress</TabsTrigger>
            <TabsTrigger value="course_update">Update</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
            <TabsTrigger value="reminder">Reminders</TabsTrigger>
            <TabsTrigger value="achievement">Achievement</TabsTrigger>
          </TabsList>
          
          <div className="flex justify-between mb-4">
          <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="read">Read</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
            </SelectContent>
          </Select>
            
          <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-[150px]">
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
            </SelectContent>
          </Select>
      </div>
      
          <TabsContent value="all" className="space-y-4">
            {filteredActivities.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-muted-foreground">No activities found</p>
                <p className="text-sm text-muted-foreground mt-2">Try adjusting your filters</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterType("all");
                    setSortOrder("newest");
                    setSelectedDateRange(undefined);
                    setSelectedActivityType("all");
                  }}
                >
                Clear Filters
              </Button>
            </div>
            ) : (
              filteredActivities.map((activity) => (
                <Card 
                    key={activity.id}
                  className={`hover:bg-muted/10 transition-colors cursor-pointer ${
                    !activity.read ? 'border-l-4 border-l-primary' : ''
                  }`}
                  onClick={() => handleActivityClick(activity)}
                  >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <ActivityIcon type={activity.type} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                          <h3 className="font-medium">{activity.title}</h3>
                          <div className="flex items-center gap-2">
                            <ActivityTypeBadge type={activity.type} source={activity.source} />
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                        <div className="flex justify-between mt-2">
                          <span className="text-xs text-muted-foreground">
                            {formatTimeAgo(new Date(activity.timestamp), language)}
                          </span>
                          {!activity.read && (
                            <Badge variant="default" className="text-xs">New</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
          
          {['student_progress', 'course_update', 'feedback', 'reminder', 'achievement'].map((type) => (
            <TabsContent key={type} value={type} className="space-y-4">
              {filteredActivities.filter(a => a.type === type).length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-muted-foreground">No {type.replace('_', ' ')} activities found</p>
                  <p className="text-sm text-muted-foreground mt-2">Try adjusting your filters</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => {
                      setSearchQuery("");
                      setFilterType("all");
                      setSortOrder("newest");
                      setSelectedDateRange(undefined);
                    }}
                  >
                  Clear Filters
                </Button>
              </div>
              ) : (
                filteredActivities.filter(a => a.type === type).map((activity) => (
                  <Card 
                    key={activity.id} 
                    className={`hover:bg-muted/10 transition-colors cursor-pointer ${
                      !activity.read ? 'border-l-4 border-l-primary' : ''
                    }`}
                    onClick={() => handleActivityClick(activity)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <ActivityIcon type={activity.type} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium">{activity.title}</h3>
                            <div className="flex items-center gap-2">
                              <ActivityTypeBadge type={activity.type} source={activity.source} />
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                          <div className="flex justify-between mt-2">
                            <span className="text-xs text-muted-foreground">
                              {formatTimeAgo(new Date(activity.timestamp), language)}
                            </span>
                            {!activity.read && (
                              <Badge variant="default" className="text-xs">New</Badge>
                            )}
                          </div>
                        </div>
                      </div>
          </CardContent>
        </Card>
                ))
              )}
            </TabsContent>
          ))}
      </Tabs>
      </div>
    </div>
  );
}

export default function ActivitiesPage() {
  return <ActivitiesPageContent />;
} 