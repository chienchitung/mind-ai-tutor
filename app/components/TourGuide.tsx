'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';

// Define the possible translation keys to make TypeScript happy
type TranslationKey = 
  | 'navigation_menu' | 'navigation_menu_desc'
  | 'dashboard_overview' | 'dashboard_overview_desc'
  | 'student_management_title' | 'student_management_tour_desc'
  | 'lessons_tour_title' | 'lessons_tour_desc'
  | 'digital_games_tour_title' | 'digital_games_tour_desc'
  | 'learning_analytics_tour_title' | 'learning_analytics_tour_desc'
  | 'step' | 'of' | 'previous' | 'next' | 'finish';

interface TourStep {
  target: string;
  titleKey: TranslationKey;
  contentKey: TranslationKey;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

interface TourGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

const tourSteps: TourStep[] = [
  {
    target: '[data-tour="sidebar"]',
    titleKey: 'navigation_menu',
    contentKey: 'navigation_menu_desc',
    placement: 'right'
  },
  {
    target: '[data-tour="stats"]',
    titleKey: 'dashboard_overview',
    contentKey: 'dashboard_overview_desc',
    placement: 'bottom'
  },
  {
    target: '[data-tour="student-management"]',
    titleKey: 'student_management_title',
    contentKey: 'student_management_tour_desc',
    placement: 'right'
  },
  {
    target: '[data-tour="lessons"]',
    titleKey: 'lessons_tour_title',
    contentKey: 'lessons_tour_desc',
    placement: 'right'
  },
  {
    target: '[data-tour="digital-games"]',
    titleKey: 'digital_games_tour_title',
    contentKey: 'digital_games_tour_desc',
    placement: 'top'
  },
  {
    target: '[data-tour="analytics"]',
    titleKey: 'learning_analytics_tour_title',
    contentKey: 'learning_analytics_tour_desc',
    placement: 'top'
  }
];

export function TourGuide({ isOpen, onClose }: TourGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [windowDimensions, setWindowDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0
  });
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isOpen && tourSteps[currentStep]) {
      const element = document.querySelector(tourSteps[currentStep].target);
      setTargetElement(element as HTMLElement);
      
      // When tour is active, prevent scrolling on body
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [currentStep, isOpen]);

  if (!isOpen || !targetElement) return null;

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
      setCurrentStep(0);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const targetRect = targetElement.getBoundingClientRect();
  const step = tourSteps[currentStep];
  
  // Calculate tooltip position to keep it within viewport
  const calculateTooltipPosition = () => {
    // Base position according to placement
    let top, left;
    
    switch(step.placement) {
      case 'bottom':
        top = targetRect.bottom + 16;
        left = targetRect.left + (targetRect.width / 2) - 160; // Center the tooltip (half of tooltip width)
        break;
      case 'top':
        top = targetRect.top - 216; // Height of tooltip + padding
        left = targetRect.left + (targetRect.width / 2) - 160;
        break;
      case 'left':
        top = targetRect.top + (targetRect.height / 2) - 100; // Half of estimated tooltip height
        left = targetRect.left - 336; // Tooltip width + padding
        break;
      case 'right':
      default:
        top = targetRect.top + (targetRect.height / 2) - 100;
        left = targetRect.right + 16;
        break;
    }
    
    // Ensure tooltip stays within viewport
    if (left < 20) left = 20;
    if (left + 320 > windowDimensions.width - 20) {
      left = Math.max(20, windowDimensions.width - 340);
    }
    
    if (top < 20) top = 20;
    if (top + 200 > windowDimensions.height - 20) {
      top = Math.max(20, windowDimensions.height - 220);
    }
    
    return { top, left };
  };
  
  const tooltipPosition = calculateTooltipPosition();

  // Create SVG mask path for the highlight
  const svgWidth = windowDimensions.width;
  const svgHeight = windowDimensions.height;
  
  // Add a small padding to the highlighted area
  const padding = 4;
  const x = targetRect.left - padding;
  const y = targetRect.top - padding;
  const width = targetRect.width + padding * 2;
  const height = targetRect.height + padding * 2;
  
  // Create path with a cutout for the highlighted element
  const maskPath = `
    M0,0 L${svgWidth},0 L${svgWidth},${svgHeight} L0,${svgHeight} Z
    M${x},${y} L${x + width},${y} L${x + width},${y + height} L${x},${y + height} Z
  `;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Semi-transparent overlay */}
      <div className="fixed inset-0" onClick={onClose}>
        {/* SVG mask with cutout */}
        <svg width="100%" height="100%" className="absolute inset-0">
          <defs>
            <mask id="tour-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect x={x} y={y} width={width} height={height} fill="black" />
            </mask>
          </defs>
          <rect 
            width="100%" 
            height="100%" 
            fill="rgba(0, 0, 0, 0.4)" 
            mask="url(#tour-mask)" 
          />
        </svg>
        
        {/* Border around the target element */}
        <div 
          className="absolute border-2 border-primary rounded-md pointer-events-none"
          style={{
            top: y,
            left: x,
            width: width,
            height: height,
            zIndex: 20,
          }}
        />
      </div>

      {/* Tour content */}
      <div
        className="absolute bg-white rounded-lg shadow-lg p-4 w-80 z-30"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
        >
          <X className="h-4 w-4" />
        </button>
        
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">{t(tourSteps[currentStep].titleKey)}</h3>
          <p className="text-sm text-gray-600">{t(tourSteps[currentStep].contentKey)}</p>
        </div>

        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-500">
            {t('step')} {currentStep + 1} {t('of')} {tourSteps.length}
          </div>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button variant="outline" size="sm" onClick={handlePrevious}>
                {t('previous')}
              </Button>
            )}
            <Button size="sm" onClick={handleNext}>
              {currentStep === tourSteps.length - 1 ? t('finish') : t('next')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 