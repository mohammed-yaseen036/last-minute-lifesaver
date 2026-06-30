// State Management
let state = {
  tasks: [],
  activeTimerTaskId: null,
  activeSubtaskIndex: null,
  timerSeconds: 1500, // 25 minutes default
  timerDuration: 1500,
  timerInterval: null,
  timerRunning: false,
  isRecording: false,
  chatHistory: [
    { role: 'ai', text: 'Hello! I am your AI Rescue Companion. Tell me what you need to finish today or drag in a task, and I\'ll generate a plan to keep you on schedule.' }
  ]
};

// Web Audio API Elements
let audioCtx = null;
let ambientNodes = [];

// Speech Recognition API
let recognition = null;
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRec();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
}

const DEFAULT_TASKS = [
  {
    id: 'task-1',
    title: 'Submit hackathon code draft',
    deadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
    quadrant: 1,
    completed: false,
    subtasks: [
      { title: 'Write core logic & functions', duration: 15, completed: false },
      { title: 'Integrate external API hooks', duration: 10, completed: false },
      { title: 'Verify and review errors', duration: 5, completed: false }
    ]
  },
  {
    id: 'task-2',
    title: 'Schedule server demo call',
    deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    quadrant: 2,
    completed: false,
    subtasks: []
  },
  {
    id: 'task-3',
    title: 'Forward email receipts to finance',
    deadline: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    quadrant: 3,
    completed: false,
    subtasks: []
  }
];

function loadTasks() {
  const stored = localStorage.getItem('lifesaver_tasks');
  if (stored) {
    state.tasks = JSON.parse(stored);
  } else {
    state.tasks = DEFAULT_TASKS;
    saveTasks();
  }
  updateStats();
  renderTasks();
}

function saveTasks() {
  localStorage.setItem('lifesaver_tasks', JSON.stringify(state.tasks));
  updateStats();
}

// UI DOM References
const listQ1 = document.getElementById('list-q1');
const listQ2 = document.getElementById('list-q2');
const listQ3 = document.getElementById('list-q3');
const listQ4 = document.getElementById('list-q4');
const statOverdue = document.getElementById('stat-overdue');
const statCompleted = document.getElementById('stat-completed');
const statPending = document.getElementById('stat-pending');

// Modal Elements
const modalAddTask = document.getElementById('modal-add-task');
const modalDecomposition = document.getElementById('modal-decomposition');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  loadTasks();
  setupEventListeners();
  setupDragAndDrop();
  updateGreeting();
  
  // Set default datetime to 1 hour from now for Task input
  const dateInput = document.getElementById('task-deadline-input');
  const now = new Date();
  now.setHours(now.getHours() + 2);
  const tzoffset = now.getTimezoneOffset() * 60000;
  const localISOTime = (new Date(now - tzoffset)).toISOString().slice(0, 16);
  dateInput.value = localISOTime;
});

function updateGreeting() {
  const hour = new Date().getHours();
  let greet = "Good evening!";
  if (hour < 12) greet = "Good morning!";
  else if (hour < 18) greet = "Good afternoon!";
  document.getElementById('greeting-title').textContent = greet;
}

// Setup Event Listeners
function setupEventListeners() {
  document.getElementById('btn-add-task').addEventListener('click', () => modalAddTask.classList.add('active'));
  document.getElementById('btn-cancel-task').addEventListener('click', closeModals);
  document.getElementById('btn-save-task').addEventListener('click', handleCreateTask);

  // Chat message sending
  document.getElementById('btn-send-message').addEventListener('click', handleSendMessage);
  document.getElementById('chat-user-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSendMessage();
  });

  // Voice quick add
  document.getElementById('btn-voice-capture').addEventListener('click', toggleVoiceRecording);

  // Timer Controls
  document.getElementById('btn-timer-start').addEventListener('click', startFocusTimer);
  document.getElementById('btn-timer-pause').addEventListener('click', pauseFocusTimer);
  document.getElementById('btn-timer-reset').addEventListener('click', resetFocusTimer);
  document.getElementById('chk-ambient-audio').addEventListener('change', toggleAmbientAudio);

  // Export Calendar navigation link
  document.getElementById('nav-open-calendar').addEventListener('click', (e) => {
    e.preventDefault();
    triggerICSDownload();
  });

  // Panic Button
  document.getElementById('btn-panic-mode').addEventListener('click', handlePanicTrigger);

  // Decompose apply button
  document.getElementById('btn-apply-decomp').addEventListener('click', handleApplyDecomposition);
  document.getElementById('btn-export-ics').addEventListener('click', triggerICSDownload);
}

function closeModals() {
  document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('active'));
}

document.querySelectorAll('.modal-close-btn').forEach(btn => {
  btn.addEventListener('click', closeModals);
});

// Create Task manually
function handleCreateTask() {
  const title = document.getElementById('task-title-input').value.trim();
  const deadlineVal = document.getElementById('task-deadline-input').value;
  const quadrant = parseInt(document.getElementById('task-quadrant-select').value);

  if (!title) {
    alert("Please enter a task title.");
    return;
  }

  const newTask = {
    id: 'task-' + Date.now(),
    title: title,
    deadline: deadlineVal ? new Date(deadlineVal).toISOString() : new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    quadrant: quadrant,
    completed: false,
    subtasks: []
  };

  state.tasks.push(newTask);
  saveTasks();
  renderTasks();
  closeModals();
  document.getElementById('task-title-input').value = '';

  // Trigger auto-decomposer
  triggerTaskDecomposition(newTask.id);
}

// Render Tasks dynamically
function renderTasks() {
  listQ1.innerHTML = '';
  listQ2.innerHTML = '';
  listQ3.innerHTML = '';
  listQ4.innerHTML = '';

  state.tasks.forEach(task => {
    const el = createTaskElement(task);
    
    if (task.quadrant === 1) listQ1.appendChild(el);
    else if (task.quadrant === 2) listQ2.appendChild(el);
    else if (task.quadrant === 3) listQ3.appendChild(el);
    else if (task.quadrant === 4) listQ4.appendChild(el);
  });
}

function createTaskElement(task) {
  const div = document.createElement('div');
  div.className = `task-item ${task.completed ? 'completed' : ''}`;
  div.draggable = true;
  div.dataset.id = task.id;

  let deadlineStr = 'No deadline';
  let isUrgent = false;
  if (task.deadline) {
    const diff = new Date(task.deadline) - new Date();
    if (diff < 0) {
      deadlineStr = 'Overdue';
      isUrgent = true;
    } else {
      const hours = Math.round(diff / (1000 * 60 * 60));
      if (hours < 1) {
        const mins = Math.round(diff / (1000 * 60));
        deadlineStr = `Due in ${mins}m`;
        isUrgent = true;
      } else if (hours < 24) {
        deadlineStr = `Due in ${hours}h`;
        isUrgent = hours < 3;
      } else {
        deadlineStr = `Due in ${Math.round(hours / 24)}d`;
      }
    }
  }

  const totalSub = task.subtasks ? task.subtasks.length : 0;
  const doneSub = task.subtasks ? task.subtasks.filter(s => s.completed).length : 0;
  const subtaskLabel = totalSub > 0 ? `<div class="task-subtasks-indicator">🎯 ${doneSub}/${totalSub}</div>` : '';

  div.innerHTML = `
    <div class="task-item-main">
      <div class="task-checkbox-wrapper">
        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
        <span class="task-text">${escapeHtml(task.title)}</span>
      </div>
      <div class="task-actions">
        <button class="task-action-btn decompose" title="Decompose Task with AI">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
        </button>
        <button class="task-action-btn delete" title="Delete Task">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>
      </div>
    </div>
    <div class="task-meta">
      <div class="task-deadline ${isUrgent ? 'urgent' : ''}">
        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        ${deadlineStr}
      </div>
      ${subtaskLabel}
    </div>
  `;

  div.querySelector('.task-checkbox').addEventListener('change', (e) => {
    task.completed = e.target.checked;
    if (task.completed && task.subtasks) {
      task.subtasks.forEach(s => s.completed = true);
    }
    saveTasks();
    renderTasks();
  });

  div.querySelector('.decompose').addEventListener('click', (e) => {
    e.stopPropagation();
    triggerTaskDecomposition(task.id);
  });

  div.querySelector('.delete').addEventListener('click', (e) => {
    e.stopPropagation();
    state.tasks = state.tasks.filter(t => t.id !== task.id);
    saveTasks();
    renderTasks();
  });

  div.addEventListener('dragstart', (e) => {
    div.classList.add('dragging');
    e.dataTransfer.setData('text/plain', task.id);
  });

  div.addEventListener('dragend', () => div.classList.remove('dragging'));
  div.addEventListener('click', () => setTimerTargetTask(task.id));

  return div;
}

// Drag & Drop
function setupDragAndDrop() {
  const quadrants = document.querySelectorAll('.matrix-quadrant');
  quadrants.forEach(quad => {
    quad.addEventListener('dragover', (e) => {
      e.preventDefault();
      quad.style.background = 'rgba(255, 255, 255, 0.03)';
    });

    quad.addEventListener('dragleave', () => {
      quad.style.background = 'rgba(255, 255, 255, 0.005)';
    });

    quad.addEventListener('drop', (e) => {
      e.preventDefault();
      quad.style.background = 'rgba(255, 255, 255, 0.005)';
      const taskId = e.dataTransfer.getData('text/plain');
      const targetQuad = parseInt(quad.dataset.quadrant);
      const task = state.tasks.find(t => t.id === taskId);
      if (task) {
        task.quadrant = targetQuad;
        saveTasks();
        renderTasks();
      }
    });
  });
}

function updateStats() {
  let overdueCount = 0;
  let completedCount = 0;
  let pendingCount = 0;

  state.tasks.forEach(t => {
    if (t.completed) {
      completedCount++;
    } else {
      pendingCount++;
      if (t.deadline && new Date(t.deadline) < new Date()) {
        overdueCount++;
      }
    }
  });

  statOverdue.textContent = overdueCount;
  statCompleted.textContent = completedCount;
  statPending.textContent = pendingCount;
}

// AI Task Decomposition Endpoint trigger
let currentDecomposingTaskId = null;
let currentDecomposedSubtasks = [];

async function triggerTaskDecomposition(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  currentDecomposingTaskId = taskId;
  document.getElementById('decomp-modal-title').textContent = `Rescue Plan: ${task.title}`;
  
  const container = document.getElementById('decomp-subtasks-container');
  container.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; padding: 2rem; color: var(--text-secondary);">
      <div class="typing-indicator" style="margin-bottom: 1rem;">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
      <p style="font-size:0.8rem;">Shielded Proxy generating micro-steps...</p>
    </div>
  `;
  modalDecomposition.classList.add('active');

  try {
    const res = await fetch('/api/decompose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: task.title })
    });

    const data = await res.json();
    if (data.error) {
      addChatMessage('system', `Error: ${data.error}`);
      container.innerHTML = `<p style="text-align: center; color: var(--color-do); font-size: 0.8rem;">${data.error}</p>`;
      return;
    }
    
    currentDecomposedSubtasks = data.subtasks;
    renderDecomposedSubtasksList(data.subtasks);
  } catch (err) {
    console.error("Failed to connect to backend api:", err);
    container.innerHTML = `<p style="text-align: center; color: var(--text-dim);">Unable to connect to the backend server.</p>`;
  }
}

function renderDecomposedSubtasksList(subtasks) {
  const container = document.getElementById('decomp-subtasks-container');
  container.innerHTML = '';

  subtasks.forEach((sub) => {
    const el = document.createElement('div');
    el.className = 'subtask-builder-item';
    el.innerHTML = `
      <span class="subtask-builder-duration">${sub.duration}m</span>
      <span class="subtask-builder-text">${escapeHtml(sub.title)}</span>
    `;
    container.appendChild(el);
  });
}

function handleApplyDecomposition() {
  const task = state.tasks.find(t => t.id === currentDecomposingTaskId);
  if (!task) return;

  task.subtasks = currentDecomposedSubtasks.map(s => ({
    title: s.title,
    duration: s.duration,
    completed: false
  }));

  saveTasks();
  renderTasks();
  closeModals();

  setTimerTargetTask(task.id, 0);
  startFocusTimer();
}

// Voice Recognition
function toggleVoiceRecording() {
  if (!recognition) {
    alert("Speech recognition is not supported in this browser. Try Chrome or Edge.");
    return;
  }

  const micBtn = document.getElementById('btn-voice-capture');

  if (state.isRecording) {
    recognition.stop();
  } else {
    state.isRecording = true;
    micBtn.classList.add('recording');
    recognition.start();
    addChatMessage('system', 'Microphone active. Say a task to schedule...');
  }
}

if (recognition) {
  recognition.onresult = async (event) => {
    const transcript = event.results[0][0].transcript;
    addChatMessage('user', `Voice: "${transcript}"`);
    await processTaskInputAI(transcript);
  };

  recognition.onerror = (event) => {
    console.error("Speech Recognition Error:", event.error);
    stopRecordingUI();
    addChatMessage('system', `Voice Capture failed: ${event.error}`);
  };

  recognition.onend = () => stopRecordingUI();
}

function stopRecordingUI() {
  state.isRecording = false;
  document.getElementById('btn-voice-capture').classList.remove('recording');
}

// Chat API Processing
async function handleSendMessage() {
  const inputEl = document.getElementById('chat-user-input');
  const query = inputEl.value.trim();
  if (!query) return;

  addChatMessage('user', query);
  inputEl.value = '';

  await processTaskInputAI(query);
}

function addChatMessage(role, text) {
  state.chatHistory.push({ role, text });
  const box = document.getElementById('chat-messages-box');
  const msgEl = document.createElement('div');
  msgEl.className = `message ${role}`;
  msgEl.innerHTML = text.split('\n\n').map(p => `<p>${escapeHtml(p)}</p>`).join('');
  box.appendChild(msgEl);
  box.scrollTop = box.scrollHeight;
}

async function processTaskInputAI(query) {
  const box = document.getElementById('chat-messages-box');
  
  const typingEl = document.createElement('div');
  typingEl.className = 'message ai typing-loader';
  typingEl.innerHTML = `
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  box.appendChild(typingEl);
  box.scrollTop = box.scrollHeight;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    typingEl.remove();
    const data = await res.json();

    if (data.error) {
      addChatMessage('system', `Guardian Block: ${data.error}`);
      return;
    }

    let replyText = data.reply;

    // Parse task data tags if any
    if (replyText.includes('<task_data>')) {
      try {
        const startIdx = replyText.indexOf('<task_data>') + 11;
        const endIdx = replyText.indexOf('</task_data>');
        const jsonStr = replyText.substring(startIdx, endIdx).trim();
        const taskData = JSON.parse(jsonStr);

        if (taskData.action === 'create') {
          const newTask = {
            id: 'task-' + Date.now(),
            title: taskData.title,
            deadline: new Date(Date.now() + taskData.hours_from_now * 60 * 60 * 1000).toISOString(),
            quadrant: taskData.quadrant,
            completed: false,
            subtasks: []
          };
          state.tasks.push(newTask);
          saveTasks();
          renderTasks();
          
          replyText = replyText.replace(/<task_data>[\s\S]*<\/task_data>/g, '').trim();
        }
      } catch (e) {
        console.error("Failed to parse task_data tag:", e);
      }
    }

    addChatMessage('ai', replyText);
  } catch (err) {
    typingEl.remove();
    console.error(err);
    addChatMessage('system', 'Connection to backend proxy server timed out.');
  }
}

// Focus Timer State & Controller
function setTimerTargetTask(taskId, subtaskIdx = null) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  state.activeTimerTaskId = taskId;
  state.activeSubtaskIndex = subtaskIdx;

  const card = document.getElementById('active-focus-card');
  const desc = document.getElementById('active-focus-desc');
  card.style.display = 'block';

  let durationMin = 25;
  if (subtaskIdx !== null && task.subtasks && task.subtasks[subtaskIdx]) {
    const sub = task.subtasks[subtaskIdx];
    desc.textContent = `[${String.fromCharCode(65 + subtaskIdx)}] ${sub.title}`;
    durationMin = sub.duration;
  } else {
    desc.textContent = task.title;
    if (task.subtasks && task.subtasks.length > 0) {
      const firstUncompleted = task.subtasks.findIndex(s => !s.completed);
      if (firstUncompleted !== -1) {
        state.activeSubtaskIndex = firstUncompleted;
        desc.textContent = `[${String.fromCharCode(65 + firstUncompleted)}] ${task.subtasks[firstUncompleted].title}`;
        durationMin = task.subtasks[firstUncompleted].duration;
      }
    }
  }

  state.timerSeconds = durationMin * 60;
  state.timerDuration = durationMin * 60;
  updateTimerDisplay();
  updateTimerRing(1);
}

function updateTimerDisplay() {
  const mins = Math.floor(state.timerSeconds / 60);
  const secs = state.timerSeconds % 60;
  document.getElementById('timer-display').textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateTimerRing(percent) {
  const ring = document.getElementById('timer-ring');
  const offset = 502 - (502 * percent);
  ring.style.strokeDashoffset = offset;
}

function startFocusTimer() {
  if (state.timerRunning) return;
  state.timerRunning = true;
  document.getElementById('timer-status-badge').textContent = 'Active';
  document.getElementById('timer-status-badge').style.color = 'var(--accent-color)';

  initAmbientAudio();

  state.timerInterval = setInterval(() => {
    state.timerSeconds--;
    updateTimerDisplay();
    updateTimerRing(state.timerSeconds / state.timerDuration);

    if (state.timerSeconds <= 0) {
      handleTimerComplete();
    }
  }, 1000);
}

function pauseFocusTimer() {
  if (!state.timerRunning) return;
  state.timerRunning = false;
  clearInterval(state.timerInterval);
  document.getElementById('timer-status-badge').textContent = 'Paused';
  document.getElementById('timer-status-badge').style.color = 'var(--color-delegate)';
  stopAmbientAudio();
}

function resetFocusTimer() {
  pauseFocusTimer();
  state.timerSeconds = state.timerDuration;
  updateTimerDisplay();
  updateTimerRing(1);
  document.getElementById('timer-status-badge').textContent = 'Idle';
  document.getElementById('timer-status-badge').style.color = 'var(--text-dim)';
}

function handleTimerComplete() {
  resetFocusTimer();
  triggerSynthNotificationTone();
  
  if (state.activeTimerTaskId !== null) {
    const task = state.tasks.find(t => t.id === state.activeTimerTaskId);
    if (task) {
      if (state.activeSubtaskIndex !== null && task.subtasks && task.subtasks[state.activeSubtaskIndex]) {
        task.subtasks[state.activeSubtaskIndex].completed = true;
        addChatMessage('system', `Completed: Focus block "${task.subtasks[state.activeSubtaskIndex].title}"`);
        
        const nextIdx = state.activeSubtaskIndex + 1;
        if (task.subtasks[nextIdx]) {
          setTimerTargetTask(task.id, nextIdx);
          addChatMessage('ai', `Step completed! Next loaded: "${task.subtasks[nextIdx].title}". Let's start.`);
        } else {
          task.completed = true;
          addChatMessage('ai', `Incredible work! You completed all steps for task "${task.title}".`);
        }
      } else {
        task.completed = true;
        addChatMessage('ai', `Focus block complete for "${task.title}".`);
      }
      saveTasks();
      renderTasks();
    }
  }
}

// Web Audio Ambient Synthesizer
function initAmbientAudio() {
  const chk = document.getElementById('chk-ambient-audio');
  if (!chk.checked) return;

  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    stopAmbientAudio();

    // Create a 6Hz Binaural Alpha wave (200Hz left, 206Hz right)
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const filter = audioCtx.createBiquadFilter();
    const gainNode = audioCtx.createGain();

    osc1.type = 'sine';
    osc1.frequency.value = 110;
    
    osc2.type = 'triangle';
    osc2.frequency.value = 110.5;

    filter.type = 'lowpass';
    filter.frequency.value = 160;

    gainNode.gain.value = 0.1;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc1.start();
    osc2.start();

    ambientNodes = [osc1, osc2, gainNode];
  } catch (e) {
    console.error(e);
  }
}

function stopAmbientAudio() {
  if (ambientNodes.length > 0) {
    ambientNodes.forEach(node => {
      try { node.stop(); } catch(e) {}
    });
    ambientNodes = [];
  }
}

function toggleAmbientAudio(e) {
  if (e.target.checked && state.timerRunning) {
    initAmbientAudio();
  } else {
    stopAmbientAudio();
  }
}

function triggerSynthNotificationTone() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
    osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1);
    osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2);
    
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } catch(e) {
    console.error(e);
  }
}

// Emergency Panic Mode Rescuer
async function handlePanicTrigger() {
  let panicTask = state.tasks.find(t => t.quadrant === 1 && !t.completed);
  if (!panicTask) {
    panicTask = state.tasks.find(t => !t.completed);
  }

  if (!panicTask) {
    addChatMessage('ai', "No pending tasks found. Add a task to run Panic Mode Rescue.");
    return;
  }

  addChatMessage('ai', `🚨 PANIC EMERGENCY INITIATED: "${panicTask.title}". Creating immediate micro-steps.`);
  triggerSynthNotificationTone();
  await triggerTaskDecomposition(panicTask.id);
}

// Calendar ICS Generator client-side
function generateICSContent() {
  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lifesaver AI//Productivity Companion//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  state.tasks.forEach(task => {
    if (task.completed) return;
    
    const uid = `task-${task.id}@lifesaver.ai`;
    const dtStamp = formatICSDate(new Date());
    const dtStart = formatICSDate(new Date(task.deadline));
    const dtEnd = formatICSDate(new Date(new Date(task.deadline).getTime() + 30 * 60 * 1000));
    
    ics.push('BEGIN:VEVENT');
    ics.push(`UID:${uid}`);
    ics.push(`DTSTAMP:${dtStamp}`);
    ics.push(`DTSTART:${dtStart}`);
    ics.push(`DTEND:${dtEnd}`);
    ics.push(`SUMMARY:⚠️ DEADLINE: ${task.title}`);
    
    let desc = `Prioritized in Eisenhower quadrant: Q${task.quadrant}.\n`;
    if (task.subtasks && task.subtasks.length > 0) {
      desc += 'AI Breakdown Steps:\n';
      task.subtasks.forEach((sub, i) => {
        desc += `- [${sub.completed ? 'x' : ' '}] ${sub.title} (${sub.duration} min)\n`;
      });
    }
    ics.push(`DESCRIPTION:${escapeICSString(desc)}`);
    ics.push('END:VEVENT');

    if (task.subtasks && task.subtasks.length > 0) {
      let accumulatedTime = 0;
      task.subtasks.forEach((sub, idx) => {
        const subStart = new Date(Date.now() + accumulatedTime * 60000);
        const subEnd = new Date(subStart.getTime() + sub.duration * 60000);
        accumulatedTime += sub.duration;

        ics.push('BEGIN:VEVENT');
        ics.push(`UID:sub-${idx}-${task.id}@lifesaver.ai`);
        ics.push(`DTSTAMP:${dtStamp}`);
        ics.push(`DTSTART:${formatICSDate(subStart)}`);
        ics.push(`DTEND:${formatICSDate(subEnd)}`);
        ics.push(`SUMMARY:🎯 FOCUS: ${sub.title}`);
        ics.push(`DESCRIPTION:Action item for parent task: ${task.title}`);
        ics.push('END:VEVENT');
      });
    }
  });

  ics.push('END:VCALENDAR');
  return ics.join('\r\n');
}

function triggerICSDownload() {
  const content = generateICSContent();
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'lifesaver-rescue-schedule.ics');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  addChatMessage('ai', 'Successfully generated calendar rescue plan! Double click the `.ics` download to sync focus blocks into Google Calendar.');
}

function formatICSDate(date) {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function escapeICSString(str) {
  return str.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
