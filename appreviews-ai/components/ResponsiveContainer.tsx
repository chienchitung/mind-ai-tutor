interface Props {
  children: React.ReactNode;
  className?: string;
}

export default function ResponsiveContainer({ children, className = '' }: Props) {
  return (
    <div className={`
      w-full
      p-4
      bg-white
      rounded-lg
      shadow
      ${className}
      h-[300px]
      md:h-[400px]
      lg:h-[500px]
    `}>
      {children}
    </div>
  );
} 