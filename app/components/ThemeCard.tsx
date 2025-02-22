interface ThemeCardProps {
    theme: {
        name: string;
        description: string | null;
    };
    month: {
        year: number;
        month: number;
    };
}

export default function ThemeCard({ theme, month }: ThemeCardProps) {
    const monthName = new Date(month.year, month.month - 1).toLocaleString('default', { month: 'long' });

    return (
        <div className="w-full">
            <div className="mx-auto">
                <div className="relative px-8 pt-10 rounded-2xl">
                    <div className="flex flex-col items-center text-center space-y-8">
                        {/* Month and Year */}
                        <div className="flex flex-col items-center gap-3">
                            <span className="text-4xl font-bold text-zinc-100 tracking-wider">
                                {monthName}
                            </span>
                            <span className="text-xl font-medium text-zinc-400/80">
                                {month.year}
                            </span>
                            <span className="px-4 py-1 rounded-full bg-blue-600 text-zinc-100">
                                {theme.name}
                            </span>
                        </div>

                        {theme.description && (
                            <p className="text-zinc-400/90 text-lg leading-relaxed whitespace-pre-wrap text-left">
                                {theme.description}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}