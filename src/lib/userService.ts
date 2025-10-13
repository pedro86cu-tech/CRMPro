interface User {
  id: string;
  email: string;
  name: string;
  status: string;
  role: string | null;
  created_at: string;
}

interface UserSearchResponse {
  success: boolean;
  data: {
    users: User[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      has_more: boolean;
    };
  };
}

export async function searchUsers(query: string = '', limit: number = 10, offset: number = 0): Promise<User[]> {
  try {
    const authSystemUrl = import.meta.env.VITE_AUTH_SYSTEM_URL;
    const appId = import.meta.env.VITE_AUTH_APP_ID;
    const apiKey = import.meta.env.VITE_AUTH_API_KEY;

    if (!authSystemUrl || !appId || !apiKey) {
      console.error('Missing authentication configuration');
      return [];
    }

    const response = await fetch(`${authSystemUrl}/api/user/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        application_id: appId,
        api_key: apiKey,
        query,
        limit,
        offset,
      }),
    });

    if (!response.ok) {
      console.error('Failed to fetch users:', response.statusText);
      return [];
    }

    const result: UserSearchResponse = await response.json();

    if (result.success && result.data.users) {
      return result.data.users.filter(user => user.status === 'active');
    }

    return [];
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
}
