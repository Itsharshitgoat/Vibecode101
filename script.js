document.addEventListener('DOMContentLoaded', () => {
    const board = document.getElementById('board');
    const fabContainer = document.getElementById('fab-container');
    const fabMainBtn = document.getElementById('fab-main-btn');
    const themeToggleBtn = document.getElementById('theme-toggle');

    let notes = [];
    let isDragging = false;
    let currentNote = null;
    let offsetX, offsetY;
    let highestZIndex = 1; // To ensure the active note is always on top

    // Theme logic
    const applyTheme = (theme) => {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('personalBoardTheme', theme);
    };

    const currentTheme = localStorage.getItem('personalBoardTheme') || 'light';
    applyTheme(currentTheme);

    themeToggleBtn.addEventListener('click', () => {
        const newTheme = document.body.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        applyTheme(newTheme);
    });

    // Instead of hardcoded hex values, we now store the index of the color variable
    // so it dynamically changes between light/dark themes
    const colorIndexes = [0, 1, 2, 3, 4];

    // Load notes from localStorage
    function loadNotes() {
        const savedNotes = localStorage.getItem('personalBoardNotes');
        if (savedNotes) {
            notes = JSON.parse(savedNotes);
            notes.forEach(noteData => {
                // Migration logic: if someone had old hex colors, default them to index 0
                if (typeof noteData.color !== 'number') {
                    noteData.color = 0;
                }
                createNoteElement(noteData, false);
            });
        } else {
            // Add a default welcome note
            addNote({
                type: 'text',
                title: "Welcome to your board",
                body: "This is a quiet space for your thoughts.\n\n- Drag anywhere\n- Click text to edit\n- Pick a subtle color\n- Add text, links or images using the + button\n- Toggle night mode",
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
        // Spread out multiple new notes by increasing randomness slightly
        const x = customData && customData.x !== undefined ? customData.x : window.innerWidth / 2 - 140 + (Math.random() * 100 - 50);
        const y = customData && customData.y !== undefined ? customData.y : window.innerHeight / 2 - 100 + (Math.random() * 100 - 50);

        const noteData = {
            id,
            type: customData && customData.type ? customData.type : 'text', // text, link, image
            title: customData && customData.title ? customData.title : '',
            body: customData && customData.body ? customData.body : '',
            imageUrl: customData && customData.imageUrl ? customData.imageUrl : '',
            x,
            y,
            color: customData && customData.color !== undefined ? customData.color : colorIndexes[0],
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
        noteEl.style.backgroundColor = `var(--note-color-${noteData.color})`;
        noteEl.style.zIndex = noteData.zIndex;

        // Keep track of max z-index to stay on top
        if (noteData.zIndex >= highestZIndex) {
            highestZIndex = noteData.zIndex + 1;
        }

        let contentHTML = '';

        if (noteData.type === 'text') {
            contentHTML = `
                <input type="text" class="note-title" placeholder="Untitled...">
                <textarea class="note-body" placeholder="Write something..."></textarea>
            `;
        } else if (noteData.type === 'link') {
            contentHTML = `
                <input type="text" class="note-title" placeholder="Link Title (Optional)">
                <input type="text" class="note-input-link" placeholder="Paste a URL here...">
            `;
        } else if (noteData.type === 'image') {
            contentHTML = `
                <input type="text" class="note-title" placeholder="Image Title (Optional)">
                <input type="text" class="note-input-image" placeholder="Paste an image URL here...">
                ${noteData.imageUrl ? `<img src="${noteData.imageUrl}" class="note-image-preview" alt="Note Image">` : ''}
            `;
        }

        // Inner HTML structure
        noteEl.innerHTML = `
            <div class="note-header">
                <div class="note-category-tags">
                    ${colorIndexes.map(cIdx => `
                        <div class="color-tag ${cIdx === noteData.color ? 'active' : ''}"
                             style="background-color: var(--note-color-${cIdx});"
                             data-color-index="${cIdx}">
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
                ${contentHTML}
            </div>
        `;

        board.appendChild(noteEl);

        // Event Listeners for the Note

        // 1. Dragging
        // Drag handler for the card itself (excluding inputs and buttons)
        noteEl.addEventListener('mousedown', startDrag);
        noteEl.addEventListener('touchstart', startDrag, { passive: false });

        // 2. Content logic based on type
        const contentContainer = noteEl.querySelector('.note-content');
        const titleInput = noteEl.querySelector('.note-title');

        if (titleInput) {
            titleInput.value = noteData.title || '';
            titleInput.addEventListener('mousedown', (e) => e.stopPropagation());
            titleInput.addEventListener('touchstart', (e) => e.stopPropagation());
            titleInput.addEventListener('focus', () => bringToFront(noteEl, noteData.id));
            titleInput.addEventListener('input', () => {
                const index = notes.findIndex(n => n.id === noteData.id);
                if (index !== -1) {
                    notes[index].title = titleInput.value;
                    saveNotes();
                }
            });
        }

        if (noteData.type === 'text') {
            const bodyInput = noteEl.querySelector('.note-body');
            bodyInput.value = noteData.body || '';
            bodyInput.addEventListener('mousedown', (e) => e.stopPropagation());
            bodyInput.addEventListener('touchstart', (e) => e.stopPropagation());
            bodyInput.addEventListener('focus', () => bringToFront(noteEl, noteData.id));

            let fetchTimeout = null;

            bodyInput.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = (this.scrollHeight) + 'px';

                const index = notes.findIndex(n => n.id === noteData.id);
                if (index !== -1) {
                    notes[index].body = bodyInput.value;
                    saveNotes();
                }

                // Debounce preview logic
                clearTimeout(fetchTimeout);
                fetchTimeout = setTimeout(() => {
                    detectAndFetchPreview(bodyInput.value);
                }, 1000);
            });

            // Trigger initial resize
            setTimeout(() => {
                bodyInput.style.height = 'auto';
                bodyInput.style.height = (bodyInput.scrollHeight) + 'px';
                if (isNew && !noteData.title && !noteData.body) titleInput.focus();
            }, 10);

            // Re-render preview if it exists
            if (noteData.preview) {
                renderPreview(noteData.preview);
            }

        } else if (noteData.type === 'link') {
            const linkInput = noteEl.querySelector('.note-input-link');
            linkInput.value = noteData.body || '';
            linkInput.addEventListener('mousedown', (e) => e.stopPropagation());
            linkInput.addEventListener('touchstart', (e) => e.stopPropagation());
            linkInput.addEventListener('focus', () => bringToFront(noteEl, noteData.id));

            if (isNew) linkInput.focus();

            let fetchTimeout = null;

            linkInput.addEventListener('input', () => {
                const index = notes.findIndex(n => n.id === noteData.id);
                if (index !== -1) {
                    notes[index].body = linkInput.value;
                    saveNotes();
                }

                clearTimeout(fetchTimeout);
                fetchTimeout = setTimeout(() => {
                    detectAndFetchPreview(linkInput.value);
                }, 1000);
            });

            if (noteData.preview) renderPreview(noteData.preview);

        } else if (noteData.type === 'image') {
            const imgInput = noteEl.querySelector('.note-input-image');
            imgInput.value = noteData.imageUrl || '';
            imgInput.addEventListener('mousedown', (e) => e.stopPropagation());
            imgInput.addEventListener('touchstart', (e) => e.stopPropagation());
            imgInput.addEventListener('focus', () => bringToFront(noteEl, noteData.id));

            if (isNew) imgInput.focus();

            let fetchTimeout = null;

            imgInput.addEventListener('input', () => {
                clearTimeout(fetchTimeout);
                fetchTimeout = setTimeout(() => {
                    const url = imgInput.value.trim();
                    const index = notes.findIndex(n => n.id === noteData.id);
                    if (index !== -1) {
                        notes[index].imageUrl = url;
                        saveNotes();
                    }

                    // Remove old image if it exists
                    const oldImg = contentContainer.querySelector('.note-image-preview');
                    if (oldImg) oldImg.remove();

                    if (url) {
                        const newImg = document.createElement('img');
                        newImg.src = url;
                        newImg.className = 'note-image-preview';
                        newImg.alt = 'Note Image';
                        newImg.onerror = () => newImg.style.display = 'none';
                        contentContainer.appendChild(newImg);
                    }
                }, 500);
            });
        }

        // --- Common Preview Logic for Text & Link ---
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

        // 3. Changing Color
        const colorTags = noteEl.querySelectorAll('.color-tag');
        colorTags.forEach(tag => {
            tag.addEventListener('click', (e) => {
                e.stopPropagation();
                const newColorIdx = parseInt(e.target.getAttribute('data-color-index'), 10);
                noteEl.style.backgroundColor = `var(--note-color-${newColorIdx})`;

                // Update active class
                colorTags.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');

                // Save
                const index = notes.findIndex(n => n.id === noteData.id);
                if (index !== -1) {
                    notes[index].color = newColorIdx;
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

    // FAB Logic
    fabMainBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fabContainer.classList.toggle('active');
    });

    // Close FAB menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!fabContainer.contains(e.target)) {
            fabContainer.classList.remove('active');
        }
    });

    // Add note types via FAB
    document.getElementById('add-text-btn').addEventListener('click', () => {
        addNote({ type: 'text' });
        fabContainer.classList.remove('active');
    });
    document.getElementById('add-link-btn').addEventListener('click', () => {
        addNote({ type: 'link' });
        fabContainer.classList.remove('active');
    });
    document.getElementById('add-img-btn').addEventListener('click', () => {
        addNote({ type: 'image' });
        fabContainer.classList.remove('active');
    });

    // Initialize
    loadNotes();
});