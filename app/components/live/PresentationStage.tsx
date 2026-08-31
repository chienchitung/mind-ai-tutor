'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MousePointer2,
  ScanLine,
  Pencil,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Minimize,
  Pin,
  PinOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import { annotationReducer, EMPTY_INK, type PresentationTool } from '@/lib/presentation-annotations';
import { AnnotationLayer } from './AnnotationLayer';
import { DeckViewer } from './DeckViewer';

const TOOLS = [
  { value: 'cursor', icon: MousePointer2, key: 'V' },
  { value: 'laser', icon: ScanLine, key: 'L' },
  { value: 'pen', icon: Pencil, key: 'P' },
  { value: 'eraser', icon: Eraser, key: 'E' },
] as const;
const COLORS = [
  { value: '#fb7185', name: 'red' },
  { value: '#facc15', name: 'yellow' },
  { value: '#38bdf8', name: 'blue' },
  { value: '#ffffff', name: 'white' },
] as const;
const ITEM =
  'flex min-h-10 cursor-default select-none items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-40';
const MENU =
  'z-[80] max-h-[var(--radix-popper-available-height,80dvh)] w-64 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-xl border bg-popover p-2 text-popover-foreground shadow-xl';
const CONTROL =
  'h-11 min-w-11 rounded-lg text-white hover:bg-white/15 hover:text-white focus-visible:ring-white';

type MenuProps = {
  kind: 'context' | 'dropdown';
  tool: PresentationTool;
  color: string;
  width: number;
  selectTool: (tool: PresentationTool) => void;
  setColor: (color: string) => void;
  setWidth: (width: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  canClear: boolean;
  undo: () => void;
  redo: () => void;
  clear: () => void;
};
function ToolMenuItems(props: MenuProps) {
  const Menu = props.kind === 'context' ? ContextMenu : DropdownMenu;
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  return (
    <>
      <Menu.Label className="px-3 py-2 text-xs font-semibold text-muted-foreground">
        {t('live_tools')}
      </Menu.Label>
      <Menu.RadioGroup
        value={props.tool}
        onValueChange={(value) => props.selectTool(value as PresentationTool)}
      >
        {TOOLS.map(({ value, icon: Icon, key }) => (
          <Menu.RadioItem key={value} value={value} className={ITEM}>
            <Icon className="h-4 w-4" />
            <span className="flex-1">{t(`live_tool_${value}`)}</span>
            <span className="text-xs text-muted-foreground">{key}</span>
            <Menu.ItemIndicator>
              <Check className="h-3 w-3" />
            </Menu.ItemIndicator>
          </Menu.RadioItem>
        ))}
      </Menu.RadioGroup>
      <Menu.Separator className="my-2 h-px bg-border" />
      <Menu.Label className="px-3 text-xs text-muted-foreground">{t('live_ink_color')}</Menu.Label>
      <Menu.RadioGroup
        value={props.color}
        onValueChange={(color) => {
          props.setColor(color);
          props.selectTool('pen');
        }}
        className="my-1 flex"
      >
        {COLORS.map(({ value, name }) => (
          <Menu.RadioItem
            key={value}
            value={value}
            aria-label={t(`live_ink_${name}`)}
            className="flex h-11 flex-1 items-center justify-center rounded-lg outline-none focus:bg-muted"
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full border border-black/20"
              style={{ background: value }}
            >
              <Menu.ItemIndicator>
                <Check className="h-4 w-4 text-black" />
              </Menu.ItemIndicator>
            </span>
          </Menu.RadioItem>
        ))}
      </Menu.RadioGroup>
      <Menu.RadioGroup
        value={String(props.width)}
        onValueChange={(value) => props.setWidth(Number(value))}
        className="flex"
        aria-label={t('live_ink_width')}
      >
        {[
          { value: 3, label: 'live_ink_thin' },
          { value: 6, label: 'live_ink_thick' },
        ].map(({ value, label }) => (
          <Menu.RadioItem key={value} value={String(value)} className={`${ITEM} flex-1`}>
            <span className="w-5 rounded bg-current" style={{ height: value }} />
            {t(label as 'live_ink_thin' | 'live_ink_thick')}
            <Menu.ItemIndicator>
              <Check className="h-3 w-3" />
            </Menu.ItemIndicator>
          </Menu.RadioItem>
        ))}
      </Menu.RadioGroup>
      <Menu.Separator className="my-2 h-px bg-border" />
      <Menu.Item className={ITEM} disabled={!props.canUndo} onSelect={props.undo}>
        <Undo2 className="h-4 w-4" />
        {t('live_ink_undo')}
      </Menu.Item>
      <Menu.Item className={ITEM} disabled={!props.canRedo} onSelect={props.redo}>
        <Redo2 className="h-4 w-4" />
        {t('live_ink_redo')}
      </Menu.Item>
      <Menu.Item className={ITEM} disabled={!props.canClear} onSelect={props.clear}>
        <Trash2 className="h-4 w-4" />
        {t('live_ink_clear')}
      </Menu.Item>
      <p className="px-3 py-2 text-xs leading-5 text-muted-foreground">{t('live_ink_notice')}</p>
    </>
  );
}

interface Props {
  open: boolean;
  url: string;
  page: number;
  numPages: number;
  title: string;
  joinCode: string;
  onExit: () => void;
  onPageChange: (page: number) => void;
  onNumPages: (pages: number) => void;
  reactions?: ReactNode;
}

/** Kept mounted by the owner: closing presentation does not throw away page notes. */
export const PresentationStage = forwardRef<HTMLDivElement, Props>(function PresentationStage(
  { open, url, page, numPages, title, joinCode, onExit, onPageChange, onNumPages, reactions },
  forwardedRef,
) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const [tool, setTool] = useState<PresentationTool>('cursor');
  const [color, setColor] = useState<string>(COLORS[0].value);
  const [width, setWidth] = useState(3);
  const [ink, dispatch] = useReducer(annotationReducer, {});
  const [drawing, setDrawing] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [visible, setVisible] = useState(true);
  const [error, setError] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const history = ink[page] ?? EMPTY_INK;
  const setStageRef = useCallback(
    (node: HTMLDivElement | null) => {
      stageRef.current = node;
      setStage(node);
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );
  const focusSlide = useCallback(() => {
    const surface = stageRef.current?.querySelector<SVGSVGElement>('[data-annotation-surface]');
    (surface ?? stageRef.current)?.focus({ preventScroll: true });
  }, []);
  const wake = useCallback(() => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!stageRef.current?.querySelector('[data-presentation-ui]:focus-within')) setVisible(false);
    }, 3000);
  }, []);
  useEffect(() => {
    if (open) {
      wake();
      setError(false);
    } else {
      setContextOpen(false);
      setToolsOpen(false);
    }
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [open, wake]);
  const selectTool = (value: PresentationTool) => {
    setTool(value);
  };
  const undo = () => dispatch({ type: 'undo', page });
  const redo = () => dispatch({ type: 'redo', page });
  const clear = () => dispatch({ type: 'clear', page });
  const menuProps = {
    tool,
    color,
    width,
    selectTool,
    setColor,
    setWidth,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    canClear: history.strokes.length > 0,
    undo,
    redo,
    clear,
  };
  const shown = !drawing && (visible || pinned || contextOpen || toolsOpen);
  const activeTool = TOOLS.find((item) => item.value === tool)!;
  const ActiveIcon = activeTool.icon;

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.nativeEvent.isComposing || drawing || contextOpen || toolsOpen)
      return;
    const target = event.target as Element;
    if (
      target.closest(
        'button, input, textarea, select, [contenteditable="true"], [role="menu"], [data-presentation-ui]',
      )
    )
      return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === 'z') {
      event.preventDefault();
      event.shiftKey ? redo() : undo();
      return;
    }
    if (event.ctrlKey && key === 'y') {
      event.preventDefault();
      redo();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const chosen = TOOLS.find((item) => item.key.toLowerCase() === key);
    if (chosen) {
      event.preventDefault();
      selectTool(chosen.value);
      wake();
      return;
    }
    if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
      event.preventDefault();
      onPageChange(Math.min(page + 1, numPages));
      wake();
    }
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
      event.preventDefault();
      onPageChange(Math.max(page - 1, 1));
      wake();
    }
  }
  const closedMenuFocus = (event: Event) => {
    event.preventDefault();
    focusSlide();
    wake();
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onExit();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black" />
        <Dialog.Content
          ref={setStageRef}
          tabIndex={-1}
          className="fixed inset-0 z-[70] h-[100dvh] w-screen overflow-hidden bg-black text-white outline-none"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            stageRef.current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (contextOpen || toolsOpen) event.preventDefault();
          }}
          onPointerDown={wake}
          onPointerMove={wake}
          onFocusCapture={wake}
          onKeyDown={handleKey}
        >
          <Dialog.Title className="sr-only">
            {t('live_projection_focus')} — {title}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            {t('live_projection_help')} {t('live_ink_notice')}
          </Dialog.Description>
          <ContextMenu.Root onOpenChange={setContextOpen} modal={false}>
            <ContextMenu.Trigger asChild>
              <div className="h-full w-full" data-presentation-slide="">
                {error ? (
                  <p
                    role="alert"
                    className="flex h-full items-center justify-center p-6 text-center text-white/80"
                  >
                    {t('live_deck_load_error')}
                  </p>
                ) : (
                  <DeckViewer
                    url={url}
                    page={page}
                    onNumPages={onNumPages}
                    onError={() => setError(true)}
                    className="h-full w-full"
                    overlay={
                      <AnnotationLayer
                        key={`${page}-${contextOpen || toolsOpen}`}
                        strokes={history.strokes}
                        tool={tool}
                        color={color}
                        width={width}
                        label={t('live_ink_surface')}
                        onCommit={(strokes) => dispatch({ type: 'commit', page, strokes })}
                        onDrawingChange={setDrawing}
                      />
                    }
                  />
                )}
              </div>
            </ContextMenu.Trigger>
            <ContextMenu.Portal container={stage}>
              <ContextMenu.Content
                data-presentation-ui=""
                className={MENU}
                collisionPadding={8}
                onCloseAutoFocus={closedMenuFocus}
              >
                <ToolMenuItems kind="context" {...menuProps} />
              </ContextMenu.Content>
            </ContextMenu.Portal>
          </ContextMenu.Root>
          {reactions}
          <div
            data-presentation-ui=""
            className={`absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/85 to-transparent p-4 transition-opacity motion-reduce:transition-none ${shown ? 'opacity-100' : 'pointer-events-none opacity-0 focus-within:opacity-100'}`}
          >
            <div className="min-w-0 rounded-xl bg-black/70 px-3 py-2 backdrop-blur-sm">
              <p className="truncate text-sm font-medium">{title}</p>
              <p className="mt-1 text-xs text-white/70">
                {t('live_join_code_label')}{' '}
                <span className="font-mono tracking-widest text-white">{joinCode}</span>
              </p>
            </div>
            <Button variant="ghost" className={CONTROL} onClick={onExit}>
              <Minimize className="h-4 w-4 sm:mr-2" />
              <span className="sr-only sm:not-sr-only">{t('live_exit_presentation')}</span>
            </Button>
          </div>
          <div
            data-presentation-ui=""
            className={`absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-opacity motion-reduce:transition-none ${shown ? 'opacity-100' : 'pointer-events-none opacity-0 focus-within:opacity-100'}`}
          >
            <p className="hidden rounded-md bg-black/70 px-3 py-1 text-[11px] text-white/70 lg:block">
              {t('live_projection_help')}
            </p>
            <div className="flex max-w-full flex-wrap items-center justify-center gap-1 rounded-2xl border border-white/15 bg-zinc-950/90 p-1.5 shadow-lg backdrop-blur-md">
              <Button
                variant="ghost"
                size="icon"
                className={CONTROL}
                aria-label={t('live_deck_prev')}
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span
                role="status"
                aria-label={t('live_slide_position', { current: page, total: numPages })}
                className="px-1 font-mono text-xs tabular-nums"
              >
                {page} / {numPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className={CONTROL}
                aria-label={t('live_deck_next')}
                disabled={page >= numPages}
                onClick={() => onPageChange(page + 1)}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
              <span className="mx-1 h-5 w-px bg-white/20" />
              <DropdownMenu.Root open={toolsOpen} onOpenChange={setToolsOpen} modal={false}>
                <DropdownMenu.Trigger asChild>
                  <Button
                    variant="ghost"
                    className={`${CONTROL} gap-2 px-2 sm:px-3`}
                    aria-label={t('live_tools')}
                  >
                    <ActiveIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">{t(`live_tool_${tool}`)}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal container={stage}>
                  <DropdownMenu.Content
                    data-presentation-ui=""
                    className={MENU}
                    side="top"
                    align="center"
                    sideOffset={12}
                    collisionPadding={8}
                    onCloseAutoFocus={closedMenuFocus}
                  >
                    <ToolMenuItems kind="dropdown" {...menuProps} />
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
              <Button
                variant="ghost"
                size="icon"
                className={CONTROL}
                disabled={!history.past.length}
                aria-label={t('live_ink_undo')}
                onClick={undo}
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`${CONTROL} hidden sm:inline-flex`}
                disabled={!history.future.length}
                aria-label={t('live_ink_redo')}
                onClick={redo}
              >
                <Redo2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`${CONTROL} hidden sm:inline-flex`}
                aria-label={t(pinned ? 'live_controls_unpin' : 'live_controls_pin')}
                aria-pressed={pinned}
                onClick={() => setPinned((value) => !value)}
              >
                {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});
