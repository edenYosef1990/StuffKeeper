export interface Link {
  id: string;
  url: string;
  name: string;
  description: string;
  tags: string[];
  createdAt: string;
}

export type LinkInput = Pick<Link, 'url' | 'name' | 'description' | 'tags'>;
