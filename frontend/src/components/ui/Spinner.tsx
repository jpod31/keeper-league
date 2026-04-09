export function Spinner({ text }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-10 h-10 border-3 border-[#21262d] border-t-[#58a6ff] rounded-full animate-spin" />
      {text && <p className="text-sm text-[#6e7681]">{text}</p>}
    </div>
  )
}
