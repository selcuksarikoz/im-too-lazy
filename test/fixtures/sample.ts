export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  roles: string[];
  score: number;
  isActive: boolean;
}

export type WorkspaceRegion = "eu" | "us" | "apac";

export class WorkspaceService {
  constructor(private readonly baseUrl: string) {}

  async listUsers(workspaceId: string): Promise<UserProfile[]> {
    const response = await fetch(
      `${this.baseUrl}/workspaces/${workspaceId}/users`,
    );
    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    return (await response.json()) as UserProfile[];
  }
}
