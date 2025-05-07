export function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="bg-card border-t border-border py-6 text-center text-muted-foreground">
      <div className="container mx-auto px-4">
        <p>&copy; {currentYear} Visionary AI. All rights reserved.</p>
      </div>
    </footer>
  );
}
