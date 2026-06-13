import { useState, useEffect } from "react";
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
    <div className="max-w-xl mx-auto w-full px-0 sm:px-4">
      <AnnouncementFeed
        alumniProfile={alumniProfile}
        companyName={companyName || "Your Company"}
      />
    </div>
  );
}
