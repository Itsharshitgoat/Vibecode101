document.addEventListener('DOMContentLoaded', () => {
    const board = document.getElementById('board');
    const addNoteBtn = document.getElementById('add-note-btn');

    let notes = [];
    let isDragging = false;
    let currentNote = null;
    let offsetX, offsetY;
    let highestZIndex = 1; // To ensure the active note is always on top

    // Colors derived from the minimalist mid-century palette, muted
    const colors = ['#FFFFFF', '#FDEEEA', '#EBF1F1', '#F7F6EE', '#E8ECEE'];

    // Load notes from localStorage
    function loadNotes() {
        const savedNotes = localStorage.getItem('personalBoardNotes');
        if (savedNotes) {
            notes = JSON.parse(savedNotes);
            notes.forEach(noteData => createNoteElement(noteData, false));
        } else {
            // Add a default welcome note
            addNote({
                title: "Welcome to your board",
                body: "This is a quiet space for your thoughts.\n\n- Drag anywhere\n- Click text to edit\n- Pick a subtle color",
                x: 100,
                y: 100
            });
        }
    }

    // Save notes to localStorage
    function saveNotes() {
        localStorage.setItem('personalBoardNotes', JSON.stringify(notes));
    }

    // Add a new note logic
    function addNote(customData = null) {
        const id = Date.now().toString();
        // Calculate a center-ish position or slight offset
        const x = customData ? customData.x : window.innerWidth / 2 - 140 + (Math.random() * 40 - 20);
        const y = customData ? customData.y : window.innerHeight / 2 - 100 + (Math.random() * 40 - 20);

        const noteData = {
            id,
            title: customData ? customData.title : '',
            body: customData ? customData.body : '',
            x,
            y,
            color: customData ? customData.color : colors[0],
            zIndex: highestZIndex++
        };

        notes.push(noteData);
        createNoteElement(noteData, true);
        saveNotes();
    }

    // Create the DOM element for a note
    function createNoteElement(noteData, isNew) {
        const noteEl = document.createElement('div');
        noteEl.classList.add('note-card');
        noteEl.id = noteData.id;

        // Position it absolutely on the board
        noteEl.style.position = 'absolute';
        noteEl.style.left = `${noteData.x}px`;
        noteEl.style.top = `${noteData.y}px`;
        noteEl.style.backgroundColor = noteData.color;
        noteEl.style.zIndex = noteData.zIndex;

        // Keep track of max z-index to stay on top
        if (noteData.zIndex >= highestZIndex) {
            highestZIndex = noteData.zIndex + 1;
        }

        // Inner HTML structure
        noteEl.innerHTML = `
            <div class="note-header">
                <div class="note-category-tags">
                    ${colors.map(color => `
                        <div class="color-tag ${color === noteData.color ? 'active' : ''}"
                             style="background-color: ${color};"
                             data-color="${color}">
                        </div>
                    `).join('')}
                </div>
                <div class="note-actions">
                    <button class="btn-icon delete-btn" aria-label="Delete note">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="note-content">
                <input type="text" class="note-title" placeholder="Untitled...">
                <textarea class="note-body" placeholder="Write something..."></textarea>
            </div>
        `;

        board.appendChild(noteEl);

        // Event Listeners for the Note

        // 1. Dragging
        // Drag handler for the card itself (excluding inputs and buttons)
        noteEl.addEventListener('mousedown', startDrag);
        noteEl.addEventListener('touchstart', startDrag, { passive: false });

        // 2. Editing Content
        const titleInput = noteEl.querySelector('.note-title');
        const bodyInput = noteEl.querySelector('.note-body');
        const contentContainer = noteEl.querySelector('.note-content');

        // Safely set values to prevent HTML injection/breaking
        titleInput.value = noteData.title || '';
        bodyInput.value = noteData.body || '';

        // Handle URL previews
        let previewEl = null;
        let fetchTimeout = null;

        const renderPreview = (previewData) => {
            if (previewEl) {
                previewEl.remove();
            }
            if (!previewData) return;

            previewEl = document.createElement('a');
            previewEl.href = previewData.url;
            previewEl.target = '_blank';
            previewEl.classList.add('note-preview-container');

            // Prevent drag when clicking the preview link
            previewEl.addEventListener('mousedown', (e) => e.stopPropagation());
            previewEl.addEventListener('touchstart', (e) => e.stopPropagation());

            // Build the DOM structure safely
            if (previewData.image) {
                const img = document.createElement('img');
                img.src = previewData.image;
                img.className = 'note-preview-image';
                img.alt = 'Preview Image';
                img.onerror = () => img.style.display = 'none';
                previewEl.appendChild(img);
            }

            const contentDiv = document.createElement('div');
            contentDiv.className = 'note-preview-content';

            if (previewData.title) {
                const titleDiv = document.createElement('div');
                titleDiv.className = 'note-preview-title';
                titleDiv.textContent = previewData.title;
                contentDiv.appendChild(titleDiv);
            }

            if (previewData.description) {
                const descDiv = document.createElement('div');
                descDiv.className = 'note-preview-desc';
                descDiv.textContent = previewData.description;
                contentDiv.appendChild(descDiv);
            }

            const urlDiv = document.createElement('div');
            urlDiv.className = 'note-preview-url';
            urlDiv.textContent = previewData.urlHost || previewData.url;
            contentDiv.appendChild(urlDiv);

            previewEl.appendChild(contentDiv);
            contentContainer.appendChild(previewEl);
        };

        const detectAndFetchPreview = async (text) => {
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const matches = text.match(urlRegex);

            if (matches && matches.length > 0) {
                const url = matches[0]; // Just take the first URL

                // If we already have this preview, don't re-fetch
                const index = notes.findIndex(n => n.id === noteData.id);
                if (index !== -1 && notes[index].preview && notes[index].preview.originalUrl === url) {
                    return;
                }

                try {
                    const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
                    const json = await response.json();

                    if (json.status === 'success') {
                        const data = json.data;
                        const previewData = {
                            originalUrl: url,
                            url: data.url || url,
                            urlHost: new URL(data.url || url).hostname,
                            title: data.title,
                            description: data.description,
                            image: data.image ? data.image.url : (data.logo ? data.logo.url : null)
                        };

                        renderPreview(previewData);

                        // Save to notes array
                        const currIndex = notes.findIndex(n => n.id === noteData.id);
                        if (currIndex !== -1) {
                            notes[currIndex].preview = previewData;
                            saveNotes();
                        }
                    }
                } catch (error) {
                    console.error('Failed to fetch preview', error);
                }
            } else {
                // If no URL found but we had a preview, remove it
                if (previewEl) {
                    previewEl.remove();
                    previewEl = null;
                    const index = notes.findIndex(n => n.id === noteData.id);
                    if (index !== -1 && notes[index].preview) {
                        delete notes[index].preview;
                        saveNotes();
                    }
                }
            }
        };

        // Render initial preview if it exists
        if (noteData.preview) {
            renderPreview(noteData.preview);
        }

        const updateContent = () => {
            const index = notes.findIndex(n => n.id === noteData.id);
            if (index !== -1) {
                notes[index].title = titleInput.value;
                notes[index].body = bodyInput.value;
                saveNotes();
            }

            // Debounce the preview fetching
            clearTimeout(fetchTimeout);
            fetchTimeout = setTimeout(() => {
                detectAndFetchPreview(bodyInput.value);
            }, 1000);
        };

        titleInput.addEventListener('input', updateContent);
        bodyInput.addEventListener('input', updateContent);

        // Auto-resize textarea
        bodyInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });

        // Prevent dragging when interacting with inputs
        titleInput.addEventListener('mousedown', (e) => e.stopPropagation());
        bodyInput.addEventListener('mousedown', (e) => e.stopPropagation());
        titleInput.addEventListener('touchstart', (e) => e.stopPropagation());
        bodyInput.addEventListener('touchstart', (e) => e.stopPropagation());

        // Focus management: when clicking an input, bring card to front
        titleInput.addEventListener('focus', () => bringToFront(noteEl, noteData.id));
        bodyInput.addEventListener('focus', () => bringToFront(noteEl, noteData.id));

        // 3. Changing Color
        const colorTags = noteEl.querySelectorAll('.color-tag');
        colorTags.forEach(tag => {
            tag.addEventListener('click', (e) => {
                e.stopPropagation();
                const newColor = e.target.getAttribute('data-color');
                noteEl.style.backgroundColor = newColor;

                // Update active class
                colorTags.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');

                // Save
                const index = notes.findIndex(n => n.id === noteData.id);
                if (index !== -1) {
                    notes[index].color = newColor;
                    saveNotes();
                }
            });
        });

        // 4. Deleting
        const deleteBtn = noteEl.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Smooth fade out before removal
            noteEl.style.transform = 'scale(0.9)';
            noteEl.style.opacity = '0';
            setTimeout(() => {
                board.removeChild(noteEl);
                notes = notes.filter(n => n.id !== noteData.id);
                saveNotes();
            }, 200);
        });

        // Trigger resize once for all notes
        setTimeout(() => {
            bodyInput.style.height = 'auto';
            bodyInput.style.height = (bodyInput.scrollHeight) + 'px';

            if (isNew && !noteData.title && !noteData.body) {
                 // If new, focus the title
                 titleInput.focus();
            }
        }, 10);
    }

    // Bring note to front
    function bringToFront(element, id) {
        highestZIndex++;
        element.style.zIndex = highestZIndex;
        const index = notes.findIndex(n => n.id === id);
        if (index !== -1) {
            notes[index].zIndex = highestZIndex;
            saveNotes();
        }
    }

    // Drag and Drop Logic
    function startDrag(e) {
        // Don't drag if clicking buttons or inputs (handled by stopPropagation mostly, but double check)
        if (e.target.tagName.toLowerCase() === 'input' ||
            e.target.tagName.toLowerCase() === 'textarea' ||
            e.target.tagName.toLowerCase() === 'button' ||
            e.target.closest('.color-tag')) {
            return;
        }

        isDragging = true;
        currentNote = this; // The note element
        bringToFront(currentNote, currentNote.id);

        // Visual feedback
        currentNote.classList.add('dragging');

        // Calculate offset
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

        const rect = currentNote.getBoundingClientRect();
        offsetX = clientX - rect.left;
        offsetY = clientY - rect.top;

        // Prevent default text selection while dragging
        if (!e.type.includes('touch')) {
            e.preventDefault();
        }
    }

    function drag(e) {
        if (!isDragging || !currentNote) return;

        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

        let newX = clientX - offsetX;
        let newY = clientY - offsetY;

        // Boundary constraints (keep within viewport roughly)
        // Ensure it doesn't get completely lost off-screen
        const maxX = window.innerWidth - 100; // Leave at least 100px visible
        const maxY = window.innerHeight - 100;

        newX = Math.max(-100, Math.min(newX, maxX));
        newY = Math.max(-50, Math.min(newY, maxY));

        // Use requestAnimationFrame for smoother performance could be done,
        // but direct style updates are usually fine for simple drags
        currentNote.style.left = `${newX}px`;
        currentNote.style.top = `${newY}px`;
    }

    function stopDrag() {
        if (!isDragging || !currentNote) return;

        currentNote.classList.remove('dragging');

        // Save new position
        const index = notes.findIndex(n => n.id === currentNote.id);
        if (index !== -1) {
            notes[index].x = parseInt(currentNote.style.left, 10);
            notes[index].y = parseInt(currentNote.style.top, 10);
            saveNotes();
        }

        isDragging = false;
        currentNote = null;
    }

    // Global Event Listeners for Dragging
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);

    // Touch support
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('touchend', stopDrag);

    // Edge case: drag leaves window
    document.addEventListener('mouseleave', stopDrag);

    // Add Note Button Listener
    addNoteBtn.addEventListener('click', () => {
        // Micro-interaction is handled by CSS active state
        addNote();
    });

    // Initialize
    loadNotes();
});