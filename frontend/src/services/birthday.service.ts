import { HttpErrorResponse } from '@angular/common/http';
import { Service } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import { Birthday, BirthdayDraft } from '../data/birthday';
import { ApiService } from './api.service';

@Service()
export class BirthdayService extends ApiService {

  constructor() {
    super('birthday');
  }

  async getBirthday(userId: string): Promise<Birthday | null> {
    try {
      return await this.get<Birthday>(encodeURIComponent(userId));
    } catch (error: unknown) {

      if (error instanceof HttpErrorResponse && error.status === 404) return null;
      throw error;
    }
  }

  getFollowerBirthdays(userId: string): Promise<Birthday[]> {
    return firstValueFrom(
      this.http.get<Birthday[]>(
        `${environment.apiBaseUrl}/birthdays/${encodeURIComponent(userId)}`,
        { withCredentials: true },
      ),
    );
  }

  addBirthday(userId: string, draft: BirthdayDraft): Promise<Birthday> {
    return this.post<Birthday>(encodeURIComponent(userId), draft);
  }

  updateBirthday(userId: string, draft: BirthdayDraft): Promise<Birthday> {
    return this.patch<Birthday>(encodeURIComponent(userId), draft);
  }
}
