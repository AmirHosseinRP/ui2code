export default function Button({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className="bg-primary text-white px-4 py-2 rounded" {...props}>
      {children}
    </button>
  );
}