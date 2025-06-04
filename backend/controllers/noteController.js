import User from "../models/User";
import Note from "../models/Note";

// @desc    Get all notes for user
// @route   GET /api/notes
// @access  Private
export const getNotes = async (req, res) => {
  // build query - get notes where user is owner or collaborator
  try {
    const query = {
      $or: [{ owner: req.user._id }, { "collaborator.user": req.user._id }],
    };

    const notes = await Note.find(query)
      .populate("owner", "username email")
      .populate("collaborators.user", "username email")
      .populate("lasEditedBy", "username")
      .sort({ updated: -1 });

    res.status(200).json({
      success: true,
      data: { notes },
    });
  } catch (error) {
    console.log("Get notes error", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// @desc    Get single note
// @route   GET /api/notes/:id
// @access  Private

export const getNote = async (req, res) => {
  try {
    const { id } = req.params;
    const note = await Note.findById(id)
      .populate("owner", "username email")
      .populate("collaborators.user", "username email")
      .populate("lasEditedBy", "username");

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    if (!note.hasAccess(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Access Denied",
      });
    }
    res.status(200).json({
      success: true,
      data: { note },
    });
  } catch (error) {
    console.log("Get note error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// @desc    Create new note
// @route   POST /api/notes
// @access  Private

export const createNote = async (req, res) => {
  try {
    const { title, content, tags } = req.body;

    if (!title || title.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Title is required",
      });
    }

    const note = await Note.create({
      title: title.trim(),
      content: content || "",
      owner: req.user._id,
      lastEditedBy: req.user._id,
      tags: tags || [],
    });

    const populatedNote = await Note.findById(note._id)
      .populate("owner", "username email")
      .populate("lastEditedBy", "username");

    res.status(201).json({
      success: true,
      message: "Note created successfully",
      data: { note: populatedNote },
    });
  } catch (error) {
    console.error("Create note error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// @desc    Update note
// @route   PUT /api/notes/:id
// @access  Private
export const updateNote = async (req, res) => {
  try {
    const { title, content, tags } = req.body;

    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    // Check if user has write access
    if (!note.hasAccess(req.user._id, 'write')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - you need write permission'
      });
    }

    // Update fields if provided
    if (title !== undefined) note.title = title.trim();
    if (content !== undefined) note.content = content;
    if (tags !== undefined) note.tags = tags;
    
    note.lastEditedBy = req.user._id;

    await note.save();

    const updatedNote = await Note.findById(note._id)
      .populate('owner', 'username email')
      .populate('collaborators.user', 'username email')
      .populate('lastEditedBy', 'username');

    res.status(200).json({
      success: true,
      message: 'Note updated successfully',
      data: { note: updatedNote }
    });
  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Delete note
// @route   DELETE /api/notes/:id
// @access  Private
export const deleteNote = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    // Only owner can delete notes
    if (note.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - only note owner can delete'
      });
    }

    await Note.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};