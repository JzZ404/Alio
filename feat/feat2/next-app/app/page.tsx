import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-6 p-8 bg-gray-50">
      <h1 className="text-3xl font-bold text-gray-800">Health Assistant</h1>
      <div className="flex flex-col gap-4 w-full max-w-sm">
        <Link
          href="/caregiver"
          className="block text-center bg-blue-600 text-white text-xl font-semibold py-6 rounded-2xl shadow active:bg-blue-700"
        >
          Caregiver
        </Link>
        <Link
          href="/family"
          className="block text-center bg-green-600 text-white text-xl font-semibold py-6 rounded-2xl shadow active:bg-green-700"
        >
          Family
        </Link>
        <Link
          href="/medications"
          className="block text-center bg-purple-600 text-white text-xl font-semibold py-6 rounded-2xl shadow active:bg-purple-700"
        >
          Medications
        </Link>
      </div>
    </main>
  );
}
