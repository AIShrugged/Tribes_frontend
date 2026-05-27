export interface TaskDataUploadResponse {
  task_data_upload_id: number;
  issues_created: number;
  issues_updated: number;
  issues: Array<{
    id: number;
    name: string;
    status: 'new' | 'updated';
  }>;
}
