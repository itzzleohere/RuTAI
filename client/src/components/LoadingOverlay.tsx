interface LoadingOverlayProps {
  message: string;
}

export default function LoadingOverlay({ message }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 bg-neutral-700 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-b-transparent animate-spin mb-4" />
        <p className="text-center">{message}</p>
      </div>
    </div>
  );
}
