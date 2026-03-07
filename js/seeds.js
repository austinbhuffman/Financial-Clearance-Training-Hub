window.FC_STORAGE_KEY = "fc_training_app_v1";

window.FC_PASS_SCORE = 80;

window.FC_SEED = {
  users: [
    {
      id: "u-1",
      name: "Alex Rivera",
      team: "Financial Clearance",
      role: "supervisor",
      createdAt: "2026-02-01"
    },
    {
      id: "u-2",
      name: "Taylor Brooks",
      team: "Patient Access",
      role: "trainee",
      createdAt: "2026-02-14"
    }
  ],
  modules: [
    {
      id: "m-ins-verification",
      title: "Insurance Verification Fundamentals",
      description:
        "Verify payer details, policy status, and coverage limitations before service.",
      durationMinutes: 35,
      category: "Pre-Service",
      requiredFor: ["trainee", "supervisor"],
      passScore: 80,
      lessons: [
        {
          heading: "Verification Timing",
          content:
            "Complete primary verification at scheduling and re-verify 24-48 hours before date of service. Escalate discrepancies to supervisor before patient arrival."
        },
        {
          heading: "Mandatory Data Elements",
          content:
            "Capture policy holder name, subscriber ID, group number, effective dates, coordination of benefits status, and plan type."
        },
        {
          heading: "Coverage Checks",
          content:
            "Document network status, referral requirements, prior auth needs, deductible remaining, coinsurance, and out-of-pocket max remaining."
        }
      ],
      quiz: [
        {
          id: "q1",
          prompt: "When should insurance be re-verified for scheduled services?",
          options: [
            "Only after claim denial",
            "24-48 hours prior to date of service",
            "Only at check-in",
            "No re-verification is needed"
          ],
          correctIndex: 1,
          rationale:
            "Coverage can change between scheduling and service date; re-verification protects reimbursement and estimate accuracy."
        },
        {
          id: "q2",
          prompt: "Which item is required in verification documentation?",
          options: [
            "Patient's preferred pharmacy",
            "Group number and effective date",
            "Emergency contact",
            "Primary care physician fax number"
          ],
          correctIndex: 1,
          rationale:
            "Group number and effective dates are core eligibility fields needed for claim adjudication."
        },
        {
          id: "q3",
          prompt: "If coordination of benefits conflicts with registration data, what should happen first?",
          options: [
            "Proceed with original registration data",
            "Delete the secondary plan",
            "Escalate discrepancy before service",
            "Bill patient as self-pay"
          ],
          correctIndex: 2,
          rationale:
            "COB discrepancies require escalation and correction to avoid denials and patient complaints."
        }
      ],
      scenario: {
        title: "Coverage Conflict Resolution",
        prompt:
          "A patient scheduled for MRI has active primary and secondary plans in registration. Payer response now indicates a different primary carrier. Choose the best next action.",
        options: [
          "Ignore payer response and keep original coverage",
          "Escalate to lead, contact patient for updated COB details, and re-run eligibility",
          "Remove all insurance and mark self-pay",
          "Proceed and let coding correct later"
        ],
        correctIndex: 1,
        explanation:
          "Immediate escalation and patient outreach ensures correct sequencing before service and prevents avoidable denials."
      }
    },
    {
      id: "m-prior-auth",
      title: "Prior Authorization Workflow",
      description:
        "Submit, track, and resolve prior authorization requests for high-cost or controlled services.",
      durationMinutes: 45,
      category: "Authorization",
      requiredFor: ["trainee", "supervisor"],
      passScore: 85,
      lessons: [
        {
          heading: "Trigger Identification",
          content:
            "Use payer matrix and CPT-specific rules to identify procedures requiring prior authorization at scheduling."
        },
        {
          heading: "Submission Standards",
          content:
            "Include clinical documentation, ordering provider details, diagnosis codes, and anticipated date of service."
        },
        {
          heading: "Tracking and Escalation",
          content:
            "Set follow-up tasks every 48 hours and escalate pending requests 72 hours before service date."
        }
      ],
      quiz: [
        {
          id: "q1",
          prompt: "What is the best trigger to identify prior auth requirements?",
          options: [
            "Provider preference",
            "Payer matrix and CPT-specific rules",
            "Patient request",
            "Nursing unit policy"
          ],
          correctIndex: 1,
          rationale:
            "Authorization need is determined by payer and service-level rules, not preference."
        },
        {
          id: "q2",
          prompt: "How often should unresolved prior auth requests be followed up?",
          options: [
            "Every 48 hours",
            "Every 2 weeks",
            "Only after date of service",
            "No follow-up required"
          ],
          correctIndex: 0,
          rationale:
            "Frequent follow-up reduces last-minute delays and rescheduling risk."
        },
        {
          id: "q3",
          prompt: "When should pending requests be escalated?",
          options: [
            "72 hours before service",
            "At claim submission",
            "After billing",
            "Never"
          ],
          correctIndex: 0,
          rationale:
            "Escalating 72 hours prior provides time to avoid canceled or delayed care."
        }
      ],
      scenario: {
        title: "Urgent Oncology Authorization",
        prompt:
          "An oncology infusion is scheduled in 3 days and the authorization remains pending. What should you do now?",
        options: [
          "Wait for auto-response",
          "Escalate immediately, contact payer escalation line, notify clinic leadership",
          "Cancel treatment",
          "Bill as no-auth required"
        ],
        correctIndex: 1,
        explanation:
          "Urgent clinical services require immediate escalation and cross-team communication."
      }
    },
    {
      id: "m-estimates",
      title: "Patient Estimate and Counseling",
      description:
        "Build transparent estimates and communicate patient responsibility clearly.",
      durationMinutes: 30,
      category: "Patient Financial Experience",
      requiredFor: ["trainee", "supervisor"],
      passScore: 80,
      lessons: [
        {
          heading: "Estimate Inputs",
          content:
            "Use contracted rates, remaining deductible, expected coinsurance, and known ancillary service assumptions."
        },
        {
          heading: "Conversation Standards",
          content:
            "Explain estimates as best-known projections, document disclaimers, and confirm payment options."
        },
        {
          heading: "Payment Pathways",
          content:
            "Offer upfront payment, installment plans, and charity screening when needed."
        }
      ],
      quiz: [
        {
          id: "q1",
          prompt: "A high-quality estimate should include:",
          options: [
            "Contracted rates and remaining deductible",
            "Only historical averages",
            "Only provider charges",
            "No assumptions"
          ],
          correctIndex: 0,
          rationale:
            "Contracted rates and benefit status produce the most accurate estimate possible pre-service."
        },
        {
          id: "q2",
          prompt: "How should estimate uncertainty be communicated?",
          options: [
            "Guarantee exact final bill",
            "Avoid discussing uncertainty",
            "Provide clear disclaimer and document discussion",
            "Send estimate without explanation"
          ],
          correctIndex: 2,
          rationale:
            "Transparency about estimate limitations prevents disputes and improves trust."
        },
        {
          id: "q3",
          prompt: "If a patient cannot pay the expected amount, staff should:",
          options: [
            "Cancel visit immediately",
            "Offer payment plan and assistance screening",
            "Require full payment only",
            "Send directly to collections"
          ],
          correctIndex: 1,
          rationale:
            "Financial counseling includes support pathways, not punitive actions."
        }
      ],
      scenario: {
        title: "Estimate Conversation",
        prompt:
          "A patient disputes the estimate because a previous visit cost less. What is the best response?",
        options: [
          "Insist current estimate is final",
          "Explain benefit changes and service differences; document discussion and provide options",
          "Tell patient billing will decide later",
          "Dismiss concern"
        ],
        correctIndex: 1,
        explanation:
          "Context, transparency, and documentation are required for compliant counseling."
      }
    },
    {
      id: "m-denials",
      title: "Denial Prevention and Appeals",
      description:
        "Identify root causes of pre-service failures and execute corrective appeals workflow.",
      durationMinutes: 40,
      category: "Revenue Integrity",
      requiredFor: ["supervisor"],
      passScore: 85,
      lessons: [
        {
          heading: "Top Pre-Service Denial Drivers",
          content:
            "Authorization missing, eligibility mismatch, wrong payer sequencing, and untimely updates."
        },
        {
          heading: "Appeal Documentation",
          content:
            "Include denial reason, timeline, supporting medical necessity records, and corrected verification evidence."
        },
        {
          heading: "Corrective Loop",
          content:
            "Track denials by root cause and retrain staff with targeted process updates."
        }
      ],
      quiz: [
        {
          id: "q1",
          prompt: "Which is a common pre-service denial driver?",
          options: [
            "Late cafeteria charge posting",
            "Missing authorization",
            "Parking validation rules",
            "Room assignment changes"
          ],
          correctIndex: 1,
          rationale:
            "Missing authorization is a leading avoidable denial cause."
        },
        {
          id: "q2",
          prompt: "Appeal packets should include:",
          options: [
            "Only a denial screenshot",
            "Denial reason, timeline, and supporting records",
            "No records if verbally approved",
            "A provider signature only"
          ],
          correctIndex: 1,
          rationale:
            "Complete evidence is necessary for successful appeal review."
        },
        {
          id: "q3",
          prompt: "How should teams use denial trend data?",
          options: [
            "Ignore trends",
            "Use trends to drive retraining and workflow updates",
            "Limit access to leadership only",
            "Delete old data monthly"
          ],
          correctIndex: 1,
          rationale:
            "Trend analysis enables continuous process correction."
        }
      ],
      scenario: {
        title: "Escalated Appeal",
        prompt:
          "A high-dollar claim denied for missing auth shows call log evidence that auth was submitted. What is the best action?",
        options: [
          "Write off balance",
          "Submit formal appeal with timeline evidence and corrected record extracts",
          "Rebill without changes",
          "Delay 90 days"
        ],
        correctIndex: 1,
        explanation:
          "Structured appeal with evidence establishes administrative error and supports overturn."
      }
    }
  ],
  assignments: [
    {
      id: "a-1",
      userId: "u-2",
      moduleId: "m-ins-verification",
      dueDate: "2026-03-12",
      assignedBy: "u-1",
      status: "assigned"
    },
    {
      id: "a-2",
      userId: "u-2",
      moduleId: "m-prior-auth",
      dueDate: "2026-03-15",
      assignedBy: "u-1",
      status: "assigned"
    }
  ],
  attempts: [],
  certifications: []
};

