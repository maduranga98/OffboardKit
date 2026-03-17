import { Timestamp } from "firebase/firestore";
import { setDocument } from "./firestore";
import type { OffboardTemplate, TemplateTask } from "../types/offboarding.types";

function task(
  id: string,
  title: string,
  description: string,
  assigneeRole: string,
  dayOffset: number,
  order: number,
  isRequired = true
): TemplateTask {
  return {
    id,
    title,
    description,
    type: "checkbox",
    assigneeRole,
    dayOffset,
    isRequired,
    order,
  };
}

const generalTasks: TemplateTask[] = [
  task("g1", "Send offboarding welcome email", "Send the employee an email outlining the offboarding process and timeline.", "hr_admin", 0, 1),
  task("g2", "Complete exit interview", "Schedule and complete the employee exit interview.", "employee", -3, 2),
  task("g3", "Submit knowledge transfer document", "Document key processes, contacts, and ongoing projects.", "employee", -5, 3),
  task("g4", "Review knowledge handover", "Review the knowledge transfer documentation for completeness.", "manager", -2, 4),
  task("g5", "Revoke all system access", "Disable accounts across all company systems and tools.", "it_admin", 0, 5),
  task("g6", "Process final payroll", "Calculate and process final paycheck including PTO balance.", "hr_admin", 0, 6),
  task("g7", "Collect company assets", "Retrieve laptop, badge, keys, and other company property.", "hr_admin", 0, 7),
  task("g8", "Send reference letter if applicable", "Prepare and send a reference or experience letter.", "hr_admin", 1, 8, false),
];

const engineerTasks: TemplateTask[] = [
  ...generalTasks,
  task("e1", "Document code repositories and projects", "Create documentation for all owned repos, services, and architecture decisions.", "employee", -7, 9),
  task("e2", "Transfer GitHub access and repos", "Transfer ownership of repositories and remove from GitHub org.", "employee", -3, 10),
  task("e3", "Record video walkthroughs of key systems", "Create recorded walkthroughs of complex systems and deployment processes.", "employee", -5, 11),
  task("e4", "Revoke AWS/GCP/cloud access", "Remove all cloud platform access and rotate shared credentials.", "it_admin", 0, 12),
  task("e5", "Complete code review handover", "Review all open PRs and reassign code review responsibilities.", "manager", -2, 13),
];

const salesTasks: TemplateTask[] = [
  ...generalTasks,
  task("s1", "Transfer CRM contacts and deals", "Reassign all active deals and client contacts in the CRM.", "employee", -5, 9),
  task("s2", "Document key client relationships", "Create handover notes for important client relationships.", "employee", -5, 10),
  task("s3", "Reassign open opportunities", "Transfer all pipeline opportunities to the assigned successor.", "manager", -3, 11),
  task("s4", "Retrieve company phone and SIM", "Collect company-issued phone, SIM card, and accessories.", "hr_admin", 0, 12),
];

export async function seedDefaultTemplates(
  companyId: string,
  selectedTemplate: string
): Promise<void> {
  const templates: { id: string; name: string; description: string; targetRole: string; tasks: TemplateTask[] }[] = [
    {
      id: "general",
      name: "General Employee Exit",
      description: "A comprehensive offboarding template suitable for most employee departures.",
      targetRole: "all",
      tasks: generalTasks,
    },
    {
      id: "engineer",
      name: "Software Engineer Exit",
      description: "Extended template with code handover, cloud access revocation, and technical documentation tasks.",
      targetRole: "engineer",
      tasks: engineerTasks,
    },
    {
      id: "sales",
      name: "Sales Representative Exit",
      description: "Includes CRM handover, client relationship documentation, and equipment retrieval.",
      targetRole: "sales",
      tasks: salesTasks,
    },
  ];

  for (const tmpl of templates) {
    const templateDoc: OffboardTemplate = {
      id: `${companyId}_${tmpl.id}`,
      companyId,
      name: tmpl.name,
      description: tmpl.description,
      targetRole: tmpl.targetRole,
      targetDepartment: "",
      isDefault: tmpl.id === selectedTemplate,
      tasks: tmpl.tasks,
      createdBy: "system",
      createdAt: Timestamp.now(),
    };

    await setDocument(
      "offboardTemplates",
      templateDoc.id,
      templateDoc
    );
  }
}
