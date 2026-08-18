import { TaskCard } from '@alio/ui';

/**
 * TaskCard appears in the Caregiver Logs conversation as Alio's reply: a short
 * spoken-style intro followed by the shift checklist. Content is the real
 * `INITIAL_CONVERSATION` fixture the app renders.
 */
const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="flex w-[300px] flex-col items-start p-3">{children}</div>
);

export const InConversation = () => (
  <Stage>
    <TaskCard
      intro="I got the number done. Here are the rest of the two do for today."
      tasks={[
        { id: 't1', label: 'Clean the toilet', done: true },
        { id: 't2', label: 'Help Sarah shower', done: false },
        { id: 't3', label: 'Daily medication', done: false },
        { id: 't4', label: 'Daily medication', done: false },
      ]}
    />
  </Stage>
);

export const AllTasksDone = () => (
  <Stage>
    <TaskCard
      intro="That's everything for this shift — nice work today."
      tasks={[
        { id: 'd1', label: 'Clean the toilet', done: true },
        { id: 'd2', label: 'Help Sarah shower', done: true },
        { id: 'd3', label: 'Daily medication', done: true },
      ]}
    />
  </Stage>
);

export const SingleTask = () => (
  <Stage>
    <TaskCard
      intro="Logged. One thing left before you head out."
      tasks={[{ id: 's1', label: 'Evening blood pressure reading', done: false }]}
    />
  </Stage>
);
