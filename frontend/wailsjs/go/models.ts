export namespace models {
	
	export class AttachmentPayload {
	    type: string;
	    content?: string;
	
	    static createFrom(source: any = {}) {
	        return new AttachmentPayload(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.content = source["content"];
	    }
	}
	export class ContentBlock {
	    type: string;
	    text?: string;
	    thinking?: string;
	    tool_use_id?: string;
	    name?: string;
	    input?: Record<string, any>;
	    content?: string;
	    is_error?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ContentBlock(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.text = source["text"];
	        this.thinking = source["thinking"];
	        this.tool_use_id = source["tool_use_id"];
	        this.name = source["name"];
	        this.input = source["input"];
	        this.content = source["content"];
	        this.is_error = source["is_error"];
	    }
	}
	export class ToolInfo {
	    type: string;
	    name: string;
	    input: Record<string, any>;
	    content: string;
	    toolUseId: string;
	    isError: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ToolInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.name = source["name"];
	        this.input = source["input"];
	        this.content = source["content"];
	        this.toolUseId = source["toolUseId"];
	        this.isError = source["isError"];
	    }
	}
	export class DisplayMessage {
	    uuid: string;
	    parentUuid?: string;
	    type: string;
	    role: string;
	    text: string;
	    thinking: string;
	    model: string;
	    // Go type: time
	    timestamp: any;
	    tokenCount: number;
	    hasTools: boolean;
	    toolCount: number;
	    tools: ToolInfo[];
	
	    static createFrom(source: any = {}) {
	        return new DisplayMessage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uuid = source["uuid"];
	        this.parentUuid = source["parentUuid"];
	        this.type = source["type"];
	        this.role = source["role"];
	        this.text = source["text"];
	        this.thinking = source["thinking"];
	        this.model = source["model"];
	        this.timestamp = this.convertValues(source["timestamp"], null);
	        this.tokenCount = source["tokenCount"];
	        this.hasTools = source["hasTools"];
	        this.toolCount = source["toolCount"];
	        this.tools = this.convertValues(source["tools"], ToolInfo);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class FileHistorySnapshot {
	    messageId: string;
	    trackedFileBackups: Record<string, any>;
	    // Go type: time
	    timestamp: any;
	
	    static createFrom(source: any = {}) {
	        return new FileHistorySnapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.messageId = source["messageId"];
	        this.trackedFileBackups = source["trackedFileBackups"];
	        this.timestamp = this.convertValues(source["timestamp"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class UsageStats {
	    input_tokens: number;
	    output_tokens: number;
	    cache_creation_input_tokens: number;
	    cache_read_input_tokens: number;
	
	    static createFrom(source: any = {}) {
	        return new UsageStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.input_tokens = source["input_tokens"];
	        this.output_tokens = source["output_tokens"];
	        this.cache_creation_input_tokens = source["cache_creation_input_tokens"];
	        this.cache_read_input_tokens = source["cache_read_input_tokens"];
	    }
	}
	export class MessagePayload {
	    id?: string;
	    type?: string;
	    role: string;
	    content: ContentBlock[];
	    model?: string;
	    usage?: UsageStats;
	
	    static createFrom(source: any = {}) {
	        return new MessagePayload(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.role = source["role"];
	        this.content = this.convertValues(source["content"], ContentBlock);
	        this.model = source["model"];
	        this.usage = this.convertValues(source["usage"], UsageStats);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class JSONLEntry {
	    uuid: string;
	    parentUuid?: string;
	    type: string;
	    // Go type: time
	    timestamp: any;
	    sessionId: string;
	    cwd: string;
	    message?: MessagePayload;
	    attachment?: AttachmentPayload;
	    operation?: string;
	    snapshot?: FileHistorySnapshot;
	    lastPrompt?: string;
	    isSidechain: boolean;
	    promptId?: string;
	    userType?: string;
	    entrypoint?: string;
	    version?: string;
	    gitBranch?: string;
	    slug?: string;
	    permissionMode?: string;
	
	    static createFrom(source: any = {}) {
	        return new JSONLEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uuid = source["uuid"];
	        this.parentUuid = source["parentUuid"];
	        this.type = source["type"];
	        this.timestamp = this.convertValues(source["timestamp"], null);
	        this.sessionId = source["sessionId"];
	        this.cwd = source["cwd"];
	        this.message = this.convertValues(source["message"], MessagePayload);
	        this.attachment = this.convertValues(source["attachment"], AttachmentPayload);
	        this.operation = source["operation"];
	        this.snapshot = this.convertValues(source["snapshot"], FileHistorySnapshot);
	        this.lastPrompt = source["lastPrompt"];
	        this.isSidechain = source["isSidechain"];
	        this.promptId = source["promptId"];
	        this.userType = source["userType"];
	        this.entrypoint = source["entrypoint"];
	        this.version = source["version"];
	        this.gitBranch = source["gitBranch"];
	        this.slug = source["slug"];
	        this.permissionMode = source["permissionMode"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class ProjectInfo {
	    name: string;
	    displayPath: string;
	    sessionCount: number;
	    totalMessages: number;
	    // Go type: time
	    lastModified: any;
	
	    static createFrom(source: any = {}) {
	        return new ProjectInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.displayPath = source["displayPath"];
	        this.sessionCount = source["sessionCount"];
	        this.totalMessages = source["totalMessages"];
	        this.lastModified = this.convertValues(source["lastModified"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SearchResult {
	    projectName: string;
	    sessionId: string;
	    messageUuid: string;
	    type: string;
	    text: string;
	    // Go type: time
	    timestamp: any;
	
	    static createFrom(source: any = {}) {
	        return new SearchResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.projectName = source["projectName"];
	        this.sessionId = source["sessionId"];
	        this.messageUuid = source["messageUuid"];
	        this.type = source["type"];
	        this.text = source["text"];
	        this.timestamp = this.convertValues(source["timestamp"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	

}

