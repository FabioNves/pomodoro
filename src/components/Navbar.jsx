import Link from "next/link";

export default function Navbar({ user, onSignOut }) {
  return (
    <nav className="flex h-16 justify-center gap-5 p-4 bg-gray-800 text-white">
      <Link href="/" className="hover:underline">
        Timer
      </Link>
      <Link href="/analytics" className="hover:underline">
        Analytics
      </Link>
      {user && (
        <button
          className="ml-4 px-3 py-1 rounded bg-red-600 hover:bg-red-700"
          onClick={onSignOut}
        >
          Sign Out
        </button>
      )}
    </nav>
  );
}
