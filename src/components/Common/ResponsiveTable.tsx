interface ResponsiveTableProps {
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveTable({ children, className = '' }: ResponsiveTableProps) {
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <div className="inline-block min-w-full align-middle">
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table className={`min-w-full divide-y divide-slate-200 ${className}`}>
            {children}
          </table>
        </div>
      </div>
    </div>
  );
}
