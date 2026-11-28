export type VerificationStatus = 'pending' | 'verified' | 'failed';

export interface UserIdCard {
  frontImage: string;
  backImage: string;
  nationalId: string | null;
  isVerified: boolean;
  verificationStatus: VerificationStatus;
  verificationError: string | null;
}

export interface User {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  age: number | null;
  birthDate: string | null;
  role: 'traveller' | 'organizer' | 'admin' | string;
  profileImage?: string;
  idCard?: UserIdCard;
  isVerified: boolean;
  isBlocked?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export class UserModel implements User {
  _id: string = '';
  name: string = '';
  email: string = '';
  password?: string;
  age: number | null = null;
  birthDate: string | null = null;
  role: 'traveller' | 'organizer' | 'admin' = 'traveller';
  profileImage: string = '';
  idCard: UserIdCard = {
    frontImage: '',
    backImage: '',
    nationalId: null,
    isVerified: false,
    verificationStatus: 'pending',
    verificationError: null,
  };
  isVerified: boolean = false;
  isBlocked: boolean = false;
  refreshToken?: string;
  createdAt?: string;
  updatedAt?: string;
}
