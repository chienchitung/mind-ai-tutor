'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Book, Clock, Users, Grid, List, Pencil, ExternalLink, ChevronDown, ChevronUp, X, Trash2, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { generatePracticeExercise } from '@/lib/gemini';

// Form schema for lesson creation
const lessonFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  duration: z.number().min(1, "Duration must be at least 1 minute"),
  level: z.string().min(1, "Level is required"),
  topics: z.string().min(1, "At least one topic is required"),
  geniallyLink: z.string().url("Please enter a valid URL").optional(),
  teachingContent: z.string().min(1, "Teaching content summary is required"),
  practiceExercises: z.array(z.object({
    question: z.string().min(1, "Question is required"),
    answer: z.string().min(1, "Answer is required"),
    explanation: z.string().min(1, "Explanation is required")
  })).min(1, "At least one practice exercise is required")
});

interface PracticeExercise {
  question: string;
  answer: string;
  explanation: string;
}

interface Lesson {
  id: string;
  title: string;
  description: string;
  duration: number;
  level: string;
  topics: string[];
  genially_link: string;
  teaching_content: string;
  practice_exercises: PracticeExercise[];
  created_at: string;
}

// Helper function to safely stringify objects for database storage
function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    console.error('Error stringifying object:', error);
    return '[]';
  }
}

// Helper function to safely parse JSON strings from database
function safeParse(str: string, defaultValue: any = []): any {
  try {
    return JSON.parse(str);
  } catch (error) {
    console.error('Error parsing JSON string:', error);
    return defaultValue;
  }
}

// Add the keyframes style to the document
const style = document.createElement('style');
style.textContent = `
  @keyframes dots {
    0%, 20% { opacity: 0; }
    50% { opacity: 1; }
    100% { opacity: 0; }
  }
`;
if (typeof document !== 'undefined') {
  document.head.appendChild(style);
}

export default function LessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [practiceExercises, setPracticeExercises] = useState<PracticeExercise[]>([
    { question: "", answer: "", explanation: "" }
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const [expandedLessons, setExpandedLessons] = useState<{ [key: string]: boolean }>({});
  const [expandedExercises, setExpandedExercises] = useState<{ [key: string]: boolean }>({});
  const [showEditForm, setShowEditForm] = useState(false);

  // Form setup
  const form = useForm<z.infer<typeof lessonFormSchema>>({
    resolver: zodResolver(lessonFormSchema),
    defaultValues: {
      title: "",
      description: "",
      duration: 30,
      level: "Beginner",
      topics: "",
      geniallyLink: "",
      teachingContent: "",
      practiceExercises: [{ question: "", answer: "", explanation: "" }]
    }
  });

  useEffect(() => {
    const fetchLessons = async () => {
      setIsLoading(true);
      try {
        console.log("Fetching lessons from lessons table");
        
        // 動態導入 supabase 函數
        const { supabase } = await import('@/lib/supabase');
        const supabaseClient = supabase();
        
        // 使用 as any 臨時解決類型問題
        const supabaseWithTypes = supabaseClient as any;
        
        const { data, error } = await supabaseWithTypes
          .from('lessons')
          .select('*');
          
        if (error) {
          throw error;
        }
        
        if (data && data.length > 0) {
          // Ensure all lessons have the expected structure
          const processedData = data.map(lesson => ({
            ...lesson,
            topics: Array.isArray(lesson.topics) ? lesson.topics : 
                   (typeof lesson.topics === 'string' ? JSON.parse(lesson.topics || '[]') : []),
            duration: lesson.duration || 0,
            level: lesson.level || 'Beginner',
            genially_link: lesson.genially_link || '',
            teaching_content: lesson.teaching_content || '',
            practice_exercises: Array.isArray(lesson.practice_exercises) ? lesson.practice_exercises : 
                               (typeof lesson.practice_exercises === 'string' && lesson.practice_exercises ? 
                                JSON.parse(lesson.practice_exercises) : [])
          }));
          setLessons(processedData);
        } else {
          // Fallback to sample data if no real data is available
          setLessons(createSampleLessons());
        }
      } catch (error) {
        toast({
          title: 'Error fetching lessons',
          description: 'Failed to load lesson data. Please try again later.',
          variant: 'destructive',
        });
        console.error('Error fetching lessons:', error);
        
        // Set sample data on error for demonstration purposes
        setLessons(createSampleLessons());
      } finally {
        setIsLoading(false);
      }
    };

    fetchLessons();
  }, [toast]);

  useEffect(() => {
    if (editingLesson) {
      form.reset({
        title: editingLesson.title,
        description: editingLesson.description,
        duration: editingLesson.duration,
        level: editingLesson.level,
        topics: editingLesson.topics.join(', '),
        geniallyLink: editingLesson.genially_link,
        teachingContent: editingLesson.teaching_content,
        practiceExercises: editingLesson.practice_exercises || []
      });
      // Ensure we have at least one practice exercise when editing
      if (editingLesson.practice_exercises && editingLesson.practice_exercises.length > 0) {
        setPracticeExercises([editingLesson.practice_exercises[0]]);
      } else {
        setPracticeExercises([{ question: "", answer: "", explanation: "" }]);
      }
    }
  }, [editingLesson, form]);

  // Add a practice exercise
  const addPracticeExercise = () => {
    setPracticeExercises([...practiceExercises, { question: "", answer: "", explanation: "" }]);
  };

  // Remove a practice exercise
  const removePracticeExercise = (index: number) => {
    // Make sure practiceExercises exists and has more than one item
    if (practiceExercises && practiceExercises.length > 1) {
      const updatedExercises = [...practiceExercises];
      updatedExercises.splice(index, 1);
      setPracticeExercises(updatedExercises);
    }
  };

  // Update practice exercises safely
  const updatePracticeExercise = (index: number, field: 'question' | 'answer' | 'explanation', value: string) => {
    if (!practiceExercises) {
      setPracticeExercises([{ question: "", answer: "", explanation: "" }]);
      return;
    }
    
    const updatedExercises = [...practiceExercises];
    if (!updatedExercises[index]) {
      updatedExercises[index] = { question: "", answer: "", explanation: "" };
    }
    updatedExercises[index][field] = value;
    setPracticeExercises(updatedExercises);
    form.setValue('practiceExercises', updatedExercises);
  };

  const onSubmit = async (values: z.infer<typeof lessonFormSchema>) => {
    try {
      // 動態導入 supabase 函數
      const { supabase } = await import('@/lib/supabase');
      const supabaseClient = supabase();
      
      // 使用 as any 臨時解決類型問題
      const supabaseWithTypes = supabaseClient as any;
      
      // Convert topics string to array
      const topicsArray = values.topics.split(',').map(topic => topic.trim());
      
      // Basic lesson data that should work with any schema
      const basicLessonData = {
        title: values.title,
        description: values.description,
        duration: values.duration,
        level: values.level,
        // Topics might need to be stored as a string in some DB schemas
        topics: topicsArray,
      };

      // Create a JSON-friendly version of the data for storage
      const jsonExtras = {
        genially_link: values.geniallyLink || '',
        teaching_content: values.teachingContent,
        practice_exercises: practiceExercises
      };

      // Store extended data as JSON in 'metadata' field if it exists
      // or try each field individually
      let lessonData: any = {
        ...basicLessonData,
        // Try both approaches - if the columns exist, they'll be used
        // If not, the error handling below will catch it
        genially_link: values.geniallyLink || '',
        teaching_content: values.teachingContent,
        practice_exercises: safeStringify(practiceExercises),
        // Also try a metadata field that might exist
        metadata: safeStringify(jsonExtras)
      };

      if (editingLesson) {
        // First try updating with all fields
        let response = await supabaseWithTypes
          .from('lessons')
          .update(lessonData)
          .eq('id', editingLesson.id);

        // If there's an error that might be due to missing columns
        if (response.error && response.error.message.includes('column') && response.error.message.includes('does not exist')) {
          console.warn('Encountered schema mismatch, trying with basic fields only:', response.error);
          
          // Try again with just the basic fields
          response = await supabaseWithTypes
            .from('lessons')
            .update(basicLessonData)
            .eq('id', editingLesson.id);
            
          if (response.error) {
            console.error('Failed even with basic fields:', response.error);
            throw response.error;
          }
        } else if (response.error) {
          throw response.error;
        }
        
        // For client-side state, use the full data model
        const updatedLesson = {
          ...editingLesson,
          ...basicLessonData,
          genially_link: values.geniallyLink || '',
          teaching_content: values.teachingContent,
          practice_exercises: practiceExercises,
        };
        
        // Update the lesson in state
        setLessons(prev => prev.map(lesson => 
          lesson.id === editingLesson.id ? updatedLesson : lesson
        ));

        toast({
          title: 'Lesson updated',
          description: 'Your lesson has been updated successfully.'
        });
        
        setShowEditForm(false);
      } else {
        // Handle creation - add created_at field
        const fullData = {
          ...lessonData,
          created_at: new Date().toISOString()
        };
        
        // First try inserting with all fields
        let response = await supabaseWithTypes
          .from('lessons')
          .insert([fullData]);

        // If there's an error that might be due to missing columns
        if (response.error && response.error.message.includes('column') && response.error.message.includes('does not exist')) {
          console.warn('Encountered schema mismatch, trying with basic fields only:', response.error);
          
          // Try again with just the basic fields
          const basicData = {
            ...basicLessonData,
            created_at: new Date().toISOString()
          };
          
          response = await supabaseWithTypes
            .from('lessons')
            .insert([basicData]);
            
          if (response.error) {
            console.error('Failed even with basic fields:', response.error);
            throw response.error;
          }
        } else if (response.error) {
          throw response.error;
        }
        
        // For client-side representation, use the full data model
        const newLesson = {
          id: Math.random().toString(36).substring(2, 9),
          ...basicLessonData,
          genially_link: values.geniallyLink || '',
          teaching_content: values.teachingContent,
          practice_exercises: practiceExercises,
          created_at: new Date().toISOString()
        };
        
        // Add the new lesson to the state
        setLessons(prev => [...prev, newLesson as Lesson]);
        
        toast({
          title: 'Lesson created',
          description: 'Your lesson has been created successfully.'
        });
        
        setShowEditForm(false);
      }
      
      setEditingLesson(null);
      form.reset();
      setPracticeExercises([{ question: "", answer: "", explanation: "" }]);
    } catch (error: any) {
      console.error('Error saving lesson:', error);
      toast({
        title: `Failed to ${editingLesson ? 'update' : 'create'} lesson`,
        description: error.message || 'There was an error. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Add delete lesson function after the onSubmit function
  const deleteLesson = async (lessonId: string) => {
    if (!confirm("Are you sure you want to delete this lesson? This action cannot be undone.")) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      // 動態導入 supabase 函數
      const { supabase } = await import('@/lib/supabase');
      const supabaseClient = supabase();
      
      // 使用 as any 臨時解決類型問題
      const supabaseWithTypes = supabaseClient as any;
      
      // Delete the lesson from Supabase
      const { error } = await supabaseWithTypes
        .from('lessons')
        .delete()
        .eq('id', lessonId);
        
      if (error) {
        throw error;
      }
      
      // Remove the lesson from the local state
      setLessons(lessons.filter(lesson => lesson.id !== lessonId));
      
      toast({
        title: 'Lesson deleted',
        description: 'The lesson has been successfully deleted.',
      });
    } catch (error: any) {
      toast({
        title: 'Error deleting lesson',
        description: error.message || 'There was an error deleting the lesson.',
        variant: 'destructive',
      });
      console.error('Error deleting lesson:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Create sample lesson data for demonstration
  function createSampleLessons(): Lesson[] {
    return [
      {
        id: '1',
        title: 'Introduction to Algebra',
        description: 'Learn the fundamentals of algebraic expressions and equations.',
        duration: 45,
        level: 'Beginner',
        topics: ['Algebra', 'Mathematics', 'Equations'],
        genially_link: 'https://view.genial.ly/sample-algebra',
        teaching_content: 'Algebra is the branch of mathematics that uses letters and symbols to represent numbers and quantities in formulas and equations. Key concepts include variables, constants, expressions, and equations. Remember that unlike arithmetic, algebraic expressions can remain in an unsolved form with variables.',
        practice_exercises: [
          {
            question: 'Solve for x: 2x + 5 = 15',
            answer: 'x = 5',
            explanation: 'The solution to the equation 2x + 5 = 15 is x = 5. This is found by isolating x on one side of the equation and solving for x.'
          },
          {
            question: 'Simplify the expression: 3(x + 2) - 4',
            answer: '3x + 2',
            explanation: 'The expression 3(x + 2) - 4 simplifies to 3x + 2. This is found by distributing the 3 to both terms inside the parentheses and then subtracting 4.'
          }
        ],
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        title: 'Advanced Geometry',
        description: 'Explore complex geometric concepts and applications.',
        duration: 60,
        level: 'Intermediate',
        topics: ['Geometry', 'Mathematics', 'Shapes'],
        genially_link: 'https://view.genial.ly/sample-geometry',
        teaching_content: 'Advanced geometry builds on basic principles to explore complex shapes and spatial relationships. Important theorems include the Pythagorean theorem, the law of sines and cosines, and properties of special quadrilaterals. Area and volume formulas are essential for solving practical problems.',
        practice_exercises: [
          {
            question: 'Find the area of a triangle with sides 5, 6, and 7 units.',
            answer: 'Area = 14.7 square units (using Heron\'s formula)',
            explanation: 'The area of a triangle with sides 5, 6, and 7 units can be found using Heron\'s formula. First, calculate the semi-perimeter (s) of the triangle: s = (5 + 6 + 7) / 2 = 9. Then, use Heron\'s formula to find the area: A = sqrt(s(s-a)(s-b)(s-c)), where a, b, and c are the lengths of the sides. Plugging in the values, we get A = sqrt(9(9-5)(9-6)(9-7)) = sqrt(9 * 4 * 3 * 2) = sqrt(216) = 14.7 square units.'
          },
          {
            question: 'In a right triangle, if one leg is 8 units and the hypotenuse is 17 units, what is the length of the other leg?',
            answer: '15 units (using the Pythagorean theorem)',
            explanation: 'The length of the other leg in a right triangle can be found using the Pythagorean theorem. The Pythagorean theorem states that in a right triangle, the square of the length of the hypotenuse (c) is equal to the sum of the squares of the lengths of the other two sides (a and b). In this case, c = 17 units and one leg (a) = 8 units. To find the length of the other leg (b), we can rearrange the equation to b = sqrt(c^2 - a^2). Plugging in the values, we get b = sqrt(17^2 - 8^2) = sqrt(289 - 64) = sqrt(225) = 15 units.'
          }
        ],
        created_at: new Date().toISOString(),
      },
      {
        id: '3',
        title: 'Physics Fundamentals',
        description: 'Understand the basic principles of physics and motion.',
        duration: 50,
        level: 'Beginner',
        topics: ['Physics', 'Science', 'Motion'],
        genially_link: 'https://view.genial.ly/sample-physics',
        teaching_content: 'Physics fundamentals include Newton\'s three laws of motion, which describe the relationship between an object and the forces acting upon it. The first law (inertia) states that an object at rest stays at rest, and an object in motion stays in motion unless acted upon by an external force. The second law defines force as mass times acceleration (F=ma). The third law states that for every action, there is an equal and opposite reaction.',
        practice_exercises: [
          {
            question: 'A 2 kg object experiences a net force of 10 N. What is its acceleration?',
            answer: '5 m/s² (using F = ma)',
            explanation: 'The acceleration of an object can be found using Newton\'s second law of motion, F = ma. In this case, the net force (F) is 10 N and the mass (m) is 2 kg. To find the acceleration (a), we can rearrange the equation to a = F / m. Plugging in the values, we get a = 10 N / 2 kg = 5 m/s².'
          },
          {
            question: 'An object is thrown upward with an initial velocity of 20 m/s. How high will it go? (g = 9.8 m/s²)',
            answer: '20.4 meters (using v² = v₀² + 2ad with final velocity = 0)',
            explanation: 'The height an object will reach when thrown upward can be found using the kinematic equations. In this case, the initial velocity (v₀) is 20 m/s, the final velocity (v) is 0 m/s (since the object reaches its maximum height and stops), and the acceleration (a) is -9.8 m/s² (due to gravity). To find the height (d), we can use the equation v² = v₀² + 2ad. Plugging in the values, we get 0² = 20² + 2(-9.8)d. Solving for d, we get d = 20² / (2 * 9.8) = 400 / 19.6 = 20.4 meters.'
          }
        ],
        created_at: new Date().toISOString(),
      },
      {
        id: '4',
        title: 'Chemistry Lab Techniques',
        description: 'Master essential laboratory techniques for chemistry experiments.',
        duration: 75,
        level: 'Advanced',
        topics: ['Chemistry', 'Science', 'Laboratory'],
        genially_link: 'https://view.genial.ly/sample-chemistry',
        teaching_content: 'Chemistry lab techniques include titration, distillation, filtration, and chromatography. Safety is paramount - always wear appropriate protective equipment and follow proper waste disposal procedures. Accuracy in measurement is critical for valid results, so learn to read instruments correctly and understand significant figures.',
        practice_exercises: [
          {
            question: 'In a titration, 25.0 mL of 0.1 M HCl is neutralized by 20.0 mL of NaOH solution. What is the molarity of the NaOH solution?',
            answer: '0.125 M NaOH (using M₁V₁ = M₂V₂)',
            explanation: 'The molarity of a solution can be found using the formula M₁V₁ = M₂V₂, where M₁ and V₁ are the molarity and volume of the initial solution, and M₂ and V₂ are the molarity and volume of the final solution. In this case, M₁ = 0.1 M, V₁ = 25.0 mL, and V₂ = 20.0 mL. To find M₂, we can rearrange the equation to M₂ = (M₁V₁) / V₂. Plugging in the values, we get M₂ = (0.1 M * 25.0 mL) / 20.0 mL = 0.125 M.'
          },
          {
            question: 'What technique would you use to separate a mixture of pigments from a plant extract?',
            answer: 'Chromatography (either column, thin-layer, or paper chromatography)',
            explanation: 'Chromatography is a technique used to separate mixtures of substances that have different affinities for a stationary phase and a mobile phase. In this case, the pigments in the plant extract have different affinities for the mobile phase (the solvent) and the stationary phase (the paper or column). The different affinities cause the pigments to travel at different speeds, allowing them to be separated.'
          }
        ],
        created_at: new Date().toISOString(),
      },
    ];
  }

  function getLevelColor(level: string) {
    switch (level.toLowerCase()) {
      case 'beginner':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'intermediate':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'advanced':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  }

  const toggleLessonExpand = (lessonId: string) => {
    setExpandedLessons(prev => ({
      ...prev,
      [lessonId]: !prev[lessonId]
    }));
  };

  const toggleExerciseAnswer = (exerciseId: string) => {
    setExpandedExercises(prev => ({
      ...prev,
      [exerciseId]: !prev[exerciseId]
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        heading="Lessons"
        text="Browse and manage educational lessons for your students."
        actions={
          <div className="flex space-x-2">
            <div className="bg-muted rounded-md p-1 flex">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-2.5"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="h-4 w-4" />
                <span className="sr-only">Grid view</span>
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-2.5"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
                <span className="sr-only">List view</span>
              </Button>
            </div>
            {!showEditForm && (
              <Button 
                onClick={() => {
                  setEditingLesson(null);
                  setShowEditForm(true);
                  setPracticeExercises([{ question: "", answer: "", explanation: "" }]);
                  form.reset();
                }}
              >
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Lesson
          </Button>
            )}
          </div>
        }
      />
      
      {isLoading ? (
        <div className="flex justify-center py-8">
          <p>Loading lesson data...</p>
        </div>
      ) : (
        <>
          {showEditForm ? (
            <>
              <div className="mb-6 flex justify-between items-center">
                <h2 className="text-xl font-semibold">{editingLesson ? 'Edit Lesson' : 'Create New Lesson'}</h2>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setShowEditForm(false);
                    setEditingLesson(null);
                    form.reset();
                    setPracticeExercises([{ question: "", answer: "", explanation: "" }]);
                  }}
                >
                  Cancel
                </Button>
              </div>
              
              {editingLesson && (
                <div className="mb-6">
                  <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                      <CardTitle>{editingLesson.title}</CardTitle>
                      <CardDescription className="line-clamp-2">{editingLesson.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <Clock className="h-4 w-4" />
                        <span>{editingLesson.duration}m</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {Array.isArray(editingLesson.topics) ? editingLesson.topics.map((topic) => (
                          <Badge key={topic} variant="outline" className="bg-muted/50">
                            {topic}
                          </Badge>
                        )) : null}
                      </div>
                      <Badge variant="outline" className={getLevelColor(editingLesson.level)}>
                        {editingLesson.level}
                      </Badge>
                      {editingLesson.genially_link && (
                        <div className="mt-3 text-sm text-blue-600">
                          <a href={editingLesson.genially_link} target="_blank" rel="noopener noreferrer" className="flex items-center hover:underline">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View Genially Presentation
                          </a>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }: { field: any }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter lesson title" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="duration"
                        render={({ field }: { field: any }) => (
                          <FormItem>
                            <FormLabel>Duration (minutes)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="level"
                        render={({ field }: { field: any }) => (
                          <FormItem>
                            <FormLabel>Level</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select level" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Beginner">Beginner</SelectItem>
                                <SelectItem value="Intermediate">Intermediate</SelectItem>
                                <SelectItem value="Advanced">Advanced</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }: { field: any }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe the lesson content" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="topics"
                      render={({ field }: { field: any }) => (
                        <FormItem>
                          <FormLabel>Topics (comma-separated)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g. Mathematics, Algebra, Equations" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="geniallyLink"
                      render={({ field }: { field: any }) => (
                        <FormItem>
                          <FormLabel>Genially Link</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter Genially presentation URL" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="teachingContent"
                    render={({ field }: { field: any }) => (
                      <FormItem>
                        <FormLabel>Create Exercise</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter a summary of the teaching content" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      className="bg-black text-white hover:bg-black/90 transition-all duration-200 flex items-center"
                      onClick={async () => {
                        const content = form.getValues("teachingContent");
                        const level = form.getValues("level");
                        if (!content) {
                          toast({
                            title: "Content Required",
                            description: "Please enter teaching content first",
                            variant: "destructive",
                          });
                          return;
                        }

                        setIsGenerating(true);

                        try {
                          const exercise = await generatePracticeExercise(content, level);
                          setPracticeExercises([exercise]);
                          form.setValue("practiceExercises", [exercise]);
                        } catch (error) {
                          toast({
                            title: "Generation Failed",
                            description: "Failed to generate practice exercise. Please try again.",
                            variant: "destructive",
                          });
                        } finally {
                          setIsGenerating(false);
                        }
                      }}
                    >
                      <Wand2 className="mr-2 h-4 w-4" />
                      {isGenerating ? (
                        <span className="inline-flex items-center">
                          Generating
                          <span className="ml-1 animate-[dots_1.5s_infinite]">.</span>
                          <span className="ml-0.5 animate-[dots_1.5s_infinite_0.2s]">.</span>
                          <span className="ml-0.5 animate-[dots_1.5s_infinite_0.4s]">.</span>
                        </span>
                      ) : (
                        "Generate Exercise"
                      )}
                    </Button>
                  </div>

                  <FormField
                    control={form.control}
                    name="practiceExercises"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Practice Exercise</FormLabel>
                          {form.formState.errors.practiceExercises && (
                            <p className="text-sm font-medium text-destructive">
                              At least one practice exercise is required
                            </p>
                          )}
                        </div>
                        <FormControl>
                          <div className="p-4 border rounded-md bg-muted/20">
                            <div className="space-y-4">
                              <div>
                                <FormLabel className="text-sm">Question</FormLabel>
                                <Textarea 
                                  placeholder="Enter the question"
                                  value={practiceExercises[0]?.question || ""}
                                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updatePracticeExercise(0, 'question', e.target.value)}
                                  className="resize-none"
                                />
                              </div>
                              <div>
                                <FormLabel className="text-sm">Answer</FormLabel>
                                <Textarea 
                                  placeholder="Enter the answer"
                                  value={practiceExercises[0]?.answer || ""}
                                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updatePracticeExercise(0, 'answer', e.target.value)}
                                  className="resize-none"
                                />
                              </div>
                              <div>
                                <FormLabel className="text-sm">Explanation</FormLabel>
                                <Textarea 
                                  placeholder="Enter the explanation"
                                  value={practiceExercises[0]?.explanation || ""}
                                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updatePracticeExercise(0, 'explanation', e.target.value)}
                                  className="resize-none"
                                />
                              </div>
                            </div>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end gap-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setShowEditForm(false);
                        setEditingLesson(null);
                        form.reset();
                        setPracticeExercises([{ question: "", answer: "", explanation: "" }]);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingLesson ? 'Save Changes' : 'Create Lesson'}
                    </Button>
                  </div>
                </form>
              </Form>
            </>
          ) : (
            <>
              {/* Grid View */}
              {viewMode === 'grid' && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {lessons.map((lesson) => (
                    <Card key={lesson.id} className="flex flex-col h-full">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xl">{lesson.title}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {lesson.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-grow">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                          <Clock className="h-4 w-4" />
                          <span>{lesson.duration}m</span>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {Array.isArray(lesson.topics) ? lesson.topics.map((topic) => (
                    <Badge key={topic} variant="outline" className="bg-muted/50">
                      {topic}
                    </Badge>
                  )) : null}
                </div>
                <Badge variant="outline" className={getLevelColor(lesson.level)}>
                  {lesson.level}
                </Badge>
                        {lesson.genially_link && (
                          <div className="mt-3 text-sm text-blue-600">
                            <a href={lesson.genially_link} target="_blank" rel="noopener noreferrer" className="flex items-center hover:underline">
                              <ExternalLink className="h-3 w-3 mr-1" />
                              View Genially Presentation
                            </a>
                          </div>
                        )}
              </CardContent>
                      <CardFooter className="bg-muted/50 pt-3 mt-auto">
                <div className="flex w-full justify-between">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-destructive hover:bg-destructive/10" 
                    onClick={() => deleteLesson(lesson.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                          <div className="flex space-x-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setEditingLesson(lesson);
                                setShowEditForm(true);
                                setPracticeExercises(lesson.practice_exercises && lesson.practice_exercises.length > 0 
                                  ? [lesson.practice_exercises[0]] 
                                  : [{ question: "", answer: "", explanation: "" }]);
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                          </div>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
              )}
              
              {/* List View */}
              {viewMode === 'list' && (
                <div className="space-y-4">
                  {lessons.map((lesson) => (
                    <Card key={lesson.id}>
                      <div className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center">
                              <h3 className="text-lg font-medium mr-2">{lesson.title}</h3>
                              <Badge variant="outline" className={getLevelColor(lesson.level)}>
                                {lesson.level}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground line-clamp-2">
                              {lesson.description}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            {/* Duration */}
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Clock className="h-4 w-4 mr-1" />
                              <span>{lesson.duration}m</span>
                            </div>

                            {/* Edit button */}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => {
                                setEditingLesson(lesson);
                                setShowEditForm(true);
                                setPracticeExercises(lesson.practice_exercises && lesson.practice_exercises.length > 0 
                                  ? [lesson.practice_exercises[0]] 
                                  : [{ question: "", answer: "", explanation: "" }]);
                              }}
                            >
                              <Pencil className="h-4 w-4 mr-1" />
                              Edit
                            </Button>

                            {/* Delete button */}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-destructive hover:bg-destructive/10" 
                              onClick={() => deleteLesson(lesson.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                        
                        {/* Expanded details section removed since we now have a view details button */}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
} 
