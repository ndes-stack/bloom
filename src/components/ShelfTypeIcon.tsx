import {
	AppWindow,
	Disc,
	File,
	FileArchive,
	FileCode,
	FileImage,
	FileMusic,
	FileSpreadsheet,
	FileText,
	FileType,
	FileVideoCamera,
	Folder,
	Presentation
} from "lucide-react";

// File extensions grouped by the icon a shelf tile shows while it has no
// preview (or for files Windows can't preview at all).
const GROUPS: [typeof File, string[]][] = [
	[
		FileImage,
		[
			"png",
			"jpg",
			"jpeg",
			"gif",
			"webp",
			"bmp",
			"ico",
			"tif",
			"tiff",
			"heic",
			"heif",
			"avif",
			"svg",
			"raw",
			"psd"
		]
	],
	[
		FileVideoCamera,
		["mp4", "mkv", "mov", "avi", "webm", "wmv", "flv", "m4v", "mpg", "mpeg", "3gp"]
	],
	[
		FileMusic,
		["mp3", "wav", "flac", "aac", "ogg", "oga", "m4a", "wma", "opus", "aiff", "mid", "midi"]
	],
	[FileSpreadsheet, ["xls", "xlsx", "xlsm", "csv", "tsv", "ods", "numbers"]],
	[Presentation, ["ppt", "pptx", "odp", "key"]],
	[FileText, ["pdf", "txt", "md", "rtf", "doc", "docx", "odt", "pages", "epub", "log"]],
	[FileArchive, ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz", "zst", "cab"]],
	[
		FileCode,
		[
			"js",
			"jsx",
			"ts",
			"tsx",
			"mjs",
			"cjs",
			"py",
			"rs",
			"c",
			"h",
			"cpp",
			"hpp",
			"cs",
			"java",
			"kt",
			"go",
			"rb",
			"php",
			"swift",
			"html",
			"htm",
			"css",
			"scss",
			"json",
			"xml",
			"yml",
			"yaml",
			"toml",
			"ini",
			"sh",
			"ps1",
			"bat",
			"cmd",
			"sql",
			"lua"
		]
	],
	[AppWindow, ["exe", "msi", "msix", "appx", "appinstaller", "lnk", "url"]],
	[Disc, ["iso", "img", "vhd", "vhdx"]],
	[FileType, ["ttf", "otf", "woff", "woff2", "fon"]]
];

const BY_EXTENSION = new Map(
	GROUPS.flatMap(([icon, exts]) => exts.map((ext) => [ext, icon] as const))
);

/** Icon for a shelf item's type, by folder or file extension. */
export function ShelfTypeIcon({
	name,
	folder,
	size = 26,
	className
}: {
	name: string;
	folder: boolean;
	size?: number;
	className?: string;
}) {
	const Icon = folder
		? Folder
		: (BY_EXTENSION.get(name.slice(name.lastIndexOf(".") + 1).toLowerCase()) ?? File);
	return <Icon size={size} strokeWidth={size < 16 ? 2 : 1.75} className={className} />;
}

// Colour and short label for each kind of file, so a tile reads at a glance:
// the badge on its preview, the tint behind a missing thumbnail, and the
// detail line under its name.
const KINDS: [string, string, string[]][] = [
	["Image", "#64748b", ["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "tif", "tiff", "heic", "heif", "avif", "svg", "raw", "psd"]],
	["Video", "#8d5a97", ["mp4", "mkv", "mov", "avi", "webm", "wmv", "flv", "m4v", "mpg", "mpeg", "3gp"]],
	["Audio", "#9b51e0", ["mp3", "wav", "flac", "aac", "ogg", "oga", "m4a", "wma", "opus", "aiff", "mid", "midi"]],
	["Sheet", "#1f8a4c", ["xls", "xlsx", "xlsm", "csv", "tsv", "ods", "numbers"]],
	["Slides", "#d35400", ["ppt", "pptx", "odp", "key"]],
	["PDF", "#e5483b", ["pdf"]],
	["Document", "#2f6fde", ["doc", "docx", "odt", "rtf", "pages", "epub"]],
	["Text", "#6b7280", ["txt", "md", "log"]],
	["Archive", "#c27c0e", ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz", "zst", "cab"]],
	[
		"Code",
		"#3572a5",
		["js", "jsx", "ts", "tsx", "mjs", "cjs", "py", "rs", "c", "h", "cpp", "hpp", "cs", "java", "kt", "go", "rb", "php", "swift", "html", "htm", "css", "scss", "json", "xml", "yml", "yaml", "toml", "ini", "sh", "ps1", "bat", "cmd", "sql", "lua"]
	],
	["App", "#4b5563", ["exe", "msi", "msix", "appx", "appinstaller", "lnk", "url"]],
	["Disk image", "#4b5563", ["iso", "img", "vhd", "vhdx"]],
	["Font", "#6b7280", ["ttf", "otf", "woff", "woff2", "fon"]]
];

const KIND_BY_EXTENSION = new Map(
	KINDS.flatMap(([label, color, exts]) => exts.map((ext) => [ext, { label, color }] as const))
);

export interface ShelfKind {
	/** Short tag on the preview: the extension, or FOLDER / TEXT. */
	badge: string;
	/** What the file is, for the detail line. */
	label: string;
	color: string;
}

export function shelfKind(name: string, folder: boolean): ShelfKind {
	if (folder) return { badge: "FOLDER", label: "Folder", color: "#1e88e5" };
	const dot = name.lastIndexOf(".");
	const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
	const kind = KIND_BY_EXTENSION.get(ext);
	const badge = ext ? ext.toUpperCase().slice(0, 5) : "FILE";
	return kind ? { badge, label: kind.label, color: kind.color } : { badge, label: "File", color: "#6b7280" };
}

export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const units = ["KB", "MB", "GB", "TB"];
	let n = bytes / 1024;
	let i = 0;
	while (n >= 1024 && i < units.length - 1) {
		n /= 1024;
		i++;
	}
	return `${n < 10 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}
