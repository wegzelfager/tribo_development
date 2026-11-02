export class UserModel {
  _id: string = '';
  name: string = '';
  email: string = '';
  password?: string;
  age: number = 0;
  role: 'traveller' | 'organizer' | 'admin' = 'traveller';
  profileImage: string = '';
  idCard: {
    frontImage: string;
    backImage: string;
    isVerified: boolean;
  } = {
    frontImage: '',
    backImage: '',
    isVerified: false,
  };
  isVerified: boolean = false;
  refreshToken?: string;
  createdAt?: string;
  updatedAt?: string;
}
