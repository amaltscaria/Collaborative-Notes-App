import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    content: {
      type: String,
      default: "",
      maxlength: [50000, "Content cannot exceed 50,000 characters"],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    collaborators: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        permission: {
          type: String,
          enum: ["read", "write"],
          default: "read",
        },
      },
    ],
    lastEditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: 30,
      },
    ],
  },
  { timestamps: true }
);

// method to check if user has acess to note

noteSchema.methods.hasAccess = function (userId, permission = "read") {
  // Owner has full access
  if (this.owner.toString() === userId) {
    return true;
  }

  // Check if user is a collaborator
  const collaborator = this.collaborators.find(
    (collaborator) => collaborator.user.toString() === userId
  );

  if (!collaborator) return false;

  if (permission === "read") {
    return ["read", "write"].includes(collaborator.permission);
  }

  return collaborator.permission === "write";
};

const Note = mongoose.model("Note", noteSchema);
export default Note;
