import { useState, useEffect } from "react";
import { Megaphone } from "lucide-react";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { AnnouncementFeed } from "../../components/alumni-portal/AnnouncementFeed";
import { useAlumniAuth } from "../../hooks/useAlumniAuth";
import { getDocument } from "../../lib/firestore";

interface Company { name: string }

export default function AlumniUpdates() {
  const { alumniProfile, loading } = useAlumniAuth();
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    if (!alumniProfile?.companyId) return;
    getDocument<Company>("companies", alumniProfile.companyId)
      .then((c) => { if (c) setCompanyName(c.name); })
      .catch(() => {});
  }, [alumniProfile?.companyId]);

  if (loading) return <LoadingSpinner fullScreen />;
  if (!alumniProfile) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Megaphone size={20} className="text-teal" />
        <h1 className="text-2xl font-display text-navy">Updates</h1>
      </div>
      <AnnouncementFeed
        alumniProfile={alumniProfile}
        companyName={companyName || "Your Company"}
      />
    </div>
  );
}
