// Project template library (shared with the browser). A template is only a
// starting suggestion: the review screen lets the user select, edit, reorder
// and remove milestones and tasks before anything is created.

const M = (name, description, tasks = []) => ({ name, description, tasks });

export const PROJECT_TEMPLATES = [
  {
    key: "saas",
    name: "SaaS",
    category: "Software",
    icon: "☁️",
    description: "From idea to a paying product with a launch and a feedback loop.",
    milestones: [
      M("Idea validation", "Confirm the problem is real and people would pay to solve it.", [
        "Write the problem statement and target customer",
        "Interview 5 potential customers",
        "Research competing products",
        "Decide go / no-go",
      ]),
      M("Product definition", "Scope the smallest version that delivers the core value.", [
        "List core features for the MVP",
        "Write user stories for the main flows",
        "Choose pricing model",
      ]),
      M("UX/UI design", "Design the main screens before building them.", [
        "Sketch the main user flows",
        "Design onboarding and dashboard screens",
        "Review designs with two users",
      ]),
      M("MVP development", "Build the core product end to end.", [
        "Set up project architecture",
        "Implement authentication",
        "Build database models",
        "Implement core functionality",
        "Connect frontend and backend",
        "Add error handling",
      ]),
      M("Testing", "Make sure the main flows work reliably.", [
        "Test main user flows",
        "Fix critical bugs",
        "Set up monitoring and error tracking",
      ]),
      M("Beta", "Put the product in front of real users.", [
        "Invite beta users",
        "Collect feedback weekly",
        "Prioritise fixes from feedback",
      ]),
      M("Launch", "Release publicly and start acquiring customers.", [
        "Prepare landing page and pricing page",
        "Set up payments",
        "Announce the launch",
      ]),
      M("Post-launch improvement", "Iterate from usage data and support requests.", [
        "Review analytics and churn",
        "Ship the top three requested improvements",
      ]),
    ],
  },
  {
    key: "software-app",
    name: "Software app",
    category: "Software",
    icon: "💻",
    description: "A mobile or desktop app from planning to store release.",
    milestones: [
      M("Planning", "Decide what the app does and for whom.", [
        "Define the app's purpose and audience",
        "List must-have features",
        "Choose platforms and tech stack",
      ]),
      M("Design", "Wireframes and visual design.", [
        "Wireframe every screen",
        "Design the visual style",
        "Prototype the main navigation",
      ]),
      M("Core development", "Implement the main features.", [
        "Set up the project and CI",
        "Build the data layer",
        "Implement the main screens",
        "Implement offline or sync behaviour",
      ]),
      M("Polish", "Performance, accessibility and edge cases.", [
        "Fix layout on small screens",
        "Improve start-up time",
        "Add empty states and error messages",
      ]),
      M("Testing", "Test on real devices.", [
        "Write tests for critical logic",
        "Run a test round on real devices",
        "Fix reported bugs",
      ]),
      M("Release", "Publish to the stores or distribute installers.", [
        "Prepare store listing and screenshots",
        "Submit for review",
        "Publish release notes",
      ]),
    ],
  },
  {
    key: "website",
    name: "Website",
    category: "Software",
    icon: "🌐",
    description: "Plan, design, build and publish a website.",
    milestones: [
      M("Goals and content", "What the site is for and what it must say.", [
        "Define the site's goal and audience",
        "Outline the pages and navigation",
        "Write the copy for each page",
      ]),
      M("Design", "Layout and visual identity.", [
        "Pick a style, fonts and colours",
        "Design the home page",
        "Design the inner pages",
      ]),
      M("Build", "Implement the pages.", [
        "Set up the project and hosting",
        "Build the layout and navigation",
        "Build every page",
        "Add the contact form",
      ]),
      M("Quality", "Speed, SEO and accessibility.", [
        "Optimise images and loading time",
        "Add titles, descriptions and Open Graph tags",
        "Check accessibility and mobile layout",
      ]),
      M("Launch", "Go live.", [
        "Connect the domain",
        "Set up analytics",
        "Publish and share",
      ]),
    ],
  },
  {
    key: "language-learning",
    name: "Language learning",
    category: "Personal",
    icon: "🗣️",
    description: "Reach conversational level step by step.",
    milestones: [
      M("Foundations", "Sounds, greetings and the most common words.", [
        "Learn the alphabet and pronunciation",
        "Learn 100 most common words",
        "Learn greetings and introductions",
      ]),
      M("Survival phrases", "Get by in everyday situations.", [
        "Learn numbers, time and dates",
        "Practise ordering food and asking directions",
        "Learn present tense of common verbs",
      ]),
      M("Basic conversation", "Hold a simple conversation.", [
        "Reach 500 words",
        "Have 5 conversations with a tutor or partner",
        "Learn past tense",
      ]),
      M("Comprehension", "Understand native content.", [
        "Watch a series with subtitles in the language",
        "Listen to a podcast weekly",
        "Read a short book",
      ]),
      M("Fluency push", "Speak comfortably about most topics.", [
        "Weekly conversation practice for 8 weeks",
        "Write a journal entry daily",
        "Take a level test",
      ]),
    ],
  },
  {
    key: "fitness-goal",
    name: "Fitness goal",
    category: "Personal",
    icon: "🏃",
    description: "Build a routine and reach a measurable target.",
    milestones: [
      M("Baseline", "Know where you start.", [
        "Record current weight and measurements",
        "Do a baseline workout test",
        "Set the target and the date",
      ]),
      M("Routine", "Make training a habit.", [
        "Pick a weekly training schedule",
        "Plan meals for the week",
        "Complete 4 weeks without missing more than 2 sessions",
      ]),
      M("Progression", "Increase intensity.", [
        "Increase load or distance every week",
        "Add one extra session per week",
        "Re-test after 8 weeks",
      ]),
      M("Target", "Hit the goal.", [
        "Final test or event",
        "Review what worked",
        "Set the next goal",
      ]),
    ],
  },
  {
    key: "moving-house",
    name: "Moving house",
    category: "Life",
    icon: "📦",
    description: "Everything from finding a place to settling in.",
    milestones: [
      M("Find a place", "Search, visit and sign.", [
        "Set the budget and must-haves",
        "Visit candidate homes",
        "Sign the contract",
      ]),
      M("Prepare the move", "Book, sort and pack.", [
        "Book movers or a van",
        "Declutter and sell or donate items",
        "Pack room by room and label boxes",
      ]),
      M("Admin", "Change addresses and utilities.", [
        "Set up electricity, water and internet",
        "Update address with bank, employer and services",
        "Redirect mail",
      ]),
      M("Moving day", "Move and hand over the old place.", [
        "Move the boxes and furniture",
        "Clean the old place",
        "Return the keys",
      ]),
      M("Settle in", "Make the new place home.", [
        "Unpack essentials first",
        "Assemble furniture",
        "Meet the neighbours",
      ]),
    ],
  },
  {
    key: "job-search",
    name: "Job search",
    category: "Career",
    icon: "💼",
    description: "A structured search from targeting to accepting an offer.",
    milestones: [
      M("Target", "Decide what you are looking for.", [
        "Define role, level, location and salary range",
        "List 20 target companies",
      ]),
      M("Materials", "CV, portfolio and profiles.", [
        "Update the CV",
        "Update LinkedIn and portfolio",
        "Prepare a cover letter template",
      ]),
      M("Applications", "Apply consistently.", [
        "Apply to 5 roles per week",
        "Reach out to 3 contacts per week",
        "Track every application",
      ]),
      M("Interviews", "Prepare and perform.", [
        "Practise common interview questions",
        "Prepare stories for behavioural questions",
        "Do a mock technical interview",
      ]),
      M("Offer", "Negotiate and decide.", [
        "Compare offers",
        "Negotiate salary and start date",
        "Accept and notify other companies",
      ]),
    ],
  },
  {
    key: "book-writing",
    name: "Book writing",
    category: "Creative",
    icon: "📖",
    description: "From outline to a finished, published manuscript.",
    milestones: [
      M("Concept and outline", "Know the story or argument before writing.", [
        "Write the premise in one paragraph",
        "Outline chapters",
        "Define the audience",
      ]),
      M("First draft", "Get the whole thing down.", [
        "Write 1,000 words per day",
        "Finish the first half",
        "Finish the first draft",
      ]),
      M("Revision", "Make it good.", [
        "Rest the manuscript for two weeks",
        "Structural edit",
        "Line edit",
      ]),
      M("Feedback", "Get outside eyes.", [
        "Send to beta readers",
        "Collect and prioritise feedback",
        "Second revision",
      ]),
      M("Publish", "Get it out into the world.", [
        "Professional edit or proofread",
        "Cover and layout",
        "Publish and announce",
      ]),
    ],
  },
  {
    key: "youtube-channel",
    name: "YouTube channel",
    category: "Creative",
    icon: "🎬",
    description: "Launch a channel and reach a steady publishing rhythm.",
    milestones: [
      M("Positioning", "Niche, audience and format.", [
        "Choose the niche and audience",
        "Study 5 channels in the space",
        "Define the video format and length",
      ]),
      M("Setup", "Channel and recording kit.", [
        "Create the channel with banner and description",
        "Set up camera, mic and lighting",
        "Prepare an editing workflow",
      ]),
      M("First 10 videos", "Learn by publishing.", [
        "Script and record the first 3 videos",
        "Publish weekly for 10 weeks",
        "Design thumbnails and titles",
      ]),
      M("Growth", "Improve from data.", [
        "Review retention and click-through rate",
        "Double down on the best-performing topics",
        "Collaborate with another creator",
      ]),
      M("Monetisation", "Turn views into income.", [
        "Reach monetisation requirements",
        "Add sponsorships or products",
      ]),
    ],
  },
  {
    key: "trip-planning",
    name: "Trip planning",
    category: "Life",
    icon: "✈️",
    description: "Plan a trip from dates to packing list.",
    milestones: [
      M("Decide", "Where, when and how much.", [
        "Pick destination and dates",
        "Set the budget",
        "Check passport and visa requirements",
      ]),
      M("Book", "Transport and stays.", [
        "Book flights or transport",
        "Book accommodation",
        "Get travel insurance",
      ]),
      M("Plan", "Itinerary and reservations.", [
        "Draft a day-by-day itinerary",
        "Reserve tours and restaurants",
        "Download maps and tickets offline",
      ]),
      M("Prepare", "Get ready to leave.", [
        "Write the packing list",
        "Arrange pet, plant or house care",
        "Exchange currency or set up cards",
      ]),
    ],
  },
  {
    key: "personal-goal",
    name: "Personal goal",
    category: "Personal",
    icon: "🎯",
    description: "A generic structure for any goal with a clear outcome.",
    milestones: [
      M("Clarify", "Define success and the deadline.", [
        "Write the goal and why it matters",
        "Define what done looks like",
        "Set the deadline",
      ]),
      M("Plan", "Break it into steps.", [
        "List the steps",
        "Schedule the first week",
        "Identify obstacles and how to handle them",
      ]),
      M("Execute", "Do the work.", [
        "Complete the first step",
        "Weekly review of progress",
        "Adjust the plan when needed",
      ]),
      M("Finish", "Complete and reflect.", [
        "Complete the final step",
        "Reflect on what worked",
      ]),
    ],
  },
  {
    key: "business-project",
    name: "Business project",
    category: "Business",
    icon: "📈",
    description: "A cross-functional project from brief to rollout.",
    milestones: [
      M("Brief", "Objectives, scope and stakeholders.", [
        "Write the objectives and success metrics",
        "Define scope and out of scope",
        "Identify stakeholders and owners",
      ]),
      M("Plan", "Schedule, budget and risks.", [
        "Break the work into workstreams",
        "Estimate the timeline and budget",
        "List risks and mitigations",
      ]),
      M("Execution", "Deliver the workstreams.", [
        "Kick-off meeting",
        "Weekly status updates",
        "Deliver each workstream",
      ]),
      M("Review", "Quality check before rollout.", [
        "Stakeholder review",
        "Fix issues from the review",
      ]),
      M("Rollout", "Launch and hand over.", [
        "Communicate the change",
        "Train the people affected",
        "Close the project and document learnings",
      ]),
    ],
  },
  {
    key: "study-project",
    name: "Study project",
    category: "Learning",
    icon: "🎓",
    description: "Prepare for an exam or master a subject.",
    milestones: [
      M("Syllabus", "Know what to learn.", [
        "Collect the syllabus and materials",
        "Split the content into topics",
        "Set the exam or completion date",
      ]),
      M("First pass", "Cover everything once.", [
        "Study each topic and take notes",
        "Make flashcards for key concepts",
      ]),
      M("Practice", "Apply what you learned.", [
        "Do exercises for every topic",
        "Take a timed practice test",
        "Review mistakes",
      ]),
      M("Revision", "Consolidate before the exam.", [
        "Revise weak topics",
        "Second practice test",
        "Final summary sheet",
      ]),
    ],
  },
  {
    key: "event-planning",
    name: "Event planning",
    category: "Life",
    icon: "🎉",
    description: "Organise an event from concept to wrap-up.",
    milestones: [
      M("Concept", "Purpose, date and budget.", [
        "Define the purpose and audience",
        "Set the date and budget",
        "Draft the guest list",
      ]),
      M("Venue and vendors", "Book the essentials.", [
        "Book the venue",
        "Book catering",
        "Arrange music, photos or entertainment",
      ]),
      M("Invitations", "Get people to come.", [
        "Send invitations",
        "Track responses",
        "Send reminders",
      ]),
      M("Programme", "Plan the day itself.", [
        "Write the schedule",
        "Assign roles to helpers",
        "Prepare materials and decorations",
      ]),
      M("Event and wrap-up", "Run it and close it.", [
        "Set up and run the event",
        "Thank guests and vendors",
        "Settle invoices and review",
      ]),
    ],
  },
];

export const TEMPLATE_CATEGORIES = Array.from(
  new Set(PROJECT_TEMPLATES.map((t) => t.category)),
);

export function getTemplate(key) {
  return PROJECT_TEMPLATES.find((t) => t.key === key) || null;
}
