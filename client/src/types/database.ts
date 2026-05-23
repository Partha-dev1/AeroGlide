/**
 * ============================================================
 * SUPABASE DATABASE TYPE DEFINITIONS — AeroGlide Platform
 * ============================================================
 * Auto-generated structure matching the production schema.
 * Tables: users, flights, airports, seats, bookings,
 *         passengers, payments, reschedules,
 *         tracking_logs, notifications
 * ============================================================
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
      };

      airports: {
        Row: {
          id: string;
          iata: string;
          name: string;
          city: string;
          country: string;
          latitude: number | null;
          longitude: number | null;
          timezone: string | null;
          is_international: boolean;
          popularity: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          iata: string;
          name: string;
          city: string;
          country: string;
          latitude?: number | null;
          longitude?: number | null;
          timezone?: string | null;
          is_international?: boolean;
          popularity?: number;
          created_at?: string;
        };
        Update: {
          iata?: string;
          name?: string;
          city?: string;
          country?: string;
          latitude?: number | null;
          longitude?: number | null;
          timezone?: string | null;
          is_international?: boolean;
          popularity?: number;
        };
      };

      flights: {
        Row: {
          id: string;
          flight_number: string;
          airline: string;
          origin_iata: string;
          destination_iata: string;
          departure_time: string;
          arrival_time: string;
          duration_minutes: number;
          base_price: number;
          status: 'scheduled' | 'boarding' | 'departed' | 'landed' | 'cancelled' | 'delayed';
          aircraft_type: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          flight_number: string;
          airline: string;
          origin_iata: string;
          destination_iata: string;
          departure_time: string;
          arrival_time: string;
          duration_minutes: number;
          base_price: number;
          status?: 'scheduled' | 'boarding' | 'departed' | 'landed' | 'cancelled' | 'delayed';
          aircraft_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          flight_number?: string;
          airline?: string;
          departure_time?: string;
          arrival_time?: string;
          base_price?: number;
          status?: 'scheduled' | 'boarding' | 'departed' | 'landed' | 'cancelled' | 'delayed';
          updated_at?: string;
        };
      };

      seats: {
        Row: {
          id: string;
          flight_id: string;
          seat_code: string;
          cabin_class: 'economy' | 'premium_economy' | 'business' | 'first';
          status: 'available' | 'locked' | 'booked' | 'blocked';
          price_modifier: number;
          lock_session: string | null;
          lock_expires_at: string | null;
          features: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          flight_id: string;
          seat_code: string;
          cabin_class?: 'economy' | 'premium_economy' | 'business' | 'first';
          status?: 'available' | 'locked' | 'booked' | 'blocked';
          price_modifier?: number;
          lock_session?: string | null;
          lock_expires_at?: string | null;
          features?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: 'available' | 'locked' | 'booked' | 'blocked';
          lock_session?: string | null;
          lock_expires_at?: string | null;
          price_modifier?: number;
          updated_at?: string;
        };
      };

      bookings: {
        Row: {
          id: string;
          booking_reference: string;
          user_id: string;
          flight_id: string;
          contact_email: string;
          contact_phone: string;
          total_price: number;
          status: 'pending' | 'confirmed' | 'cancelled' | 'rescheduled';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          booking_reference?: string;
          user_id: string;
          flight_id: string;
          contact_email: string;
          contact_phone: string;
          total_price: number;
          status?: 'pending' | 'confirmed' | 'cancelled' | 'rescheduled';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: 'pending' | 'confirmed' | 'cancelled' | 'rescheduled';
          total_price?: number;
          updated_at?: string;
        };
      };

      passengers: {
        Row: {
          id: string;
          booking_id: string;
          seat_id: string;
          first_name: string;
          last_name: string;
          passport_number: string | null;
          date_of_birth: string | null;
          nationality: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          seat_id: string;
          first_name: string;
          last_name: string;
          passport_number?: string | null;
          date_of_birth?: string | null;
          nationality?: string | null;
          created_at?: string;
        };
        Update: {
          first_name?: string;
          last_name?: string;
          passport_number?: string | null;
          date_of_birth?: string | null;
          nationality?: string | null;
        };
      };

      payments: {
        Row: {
          id: string;
          booking_id: string;
          amount: number;
          currency: string;
          status: 'pending' | 'completed' | 'failed' | 'refunded';
          payment_method: string | null;
          transaction_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          amount: number;
          currency?: string;
          status?: 'pending' | 'completed' | 'failed' | 'refunded';
          payment_method?: string | null;
          transaction_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: 'pending' | 'completed' | 'failed' | 'refunded';
          transaction_id?: string | null;
          updated_at?: string;
        };
      };

      reschedules: {
        Row: {
          id: string;
          booking_id: string;
          old_flight_id: string;
          new_flight_id: string;
          old_seat_ids: string[];
          new_seat_ids: string[];
          price_difference: number;
          status: 'pending' | 'confirmed' | 'failed';
          created_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          old_flight_id: string;
          new_flight_id: string;
          old_seat_ids: string[];
          new_seat_ids: string[];
          price_difference?: number;
          status?: 'pending' | 'confirmed' | 'failed';
          created_at?: string;
        };
        Update: {
          status?: 'pending' | 'confirmed' | 'failed';
        };
      };

      tracking_logs: {
        Row: {
          id: string;
          flight_id: string;
          event_type: string;
          details: Json | null;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          flight_id: string;
          event_type: string;
          details?: Json | null;
          recorded_at?: string;
        };
        Update: {
          details?: Json | null;
        };
      };

      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string;
          type: 'info' | 'success' | 'warning' | 'error';
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          message: string;
          type?: 'info' | 'success' | 'warning' | 'error';
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          is_read?: boolean;
        };
      };
    };

    Views: Record<string, never>;

    Functions: {
      lock_seats: {
        Args: { p_flight_id: string; p_seat_ids: string[]; p_lock_session: string };
        Returns: boolean;
      };
      create_booking_transaction: {
        Args: {
          p_flight_id: string;
          p_user_id: string;
          p_contact_email: string;
          p_contact_phone: string;
          p_total_price: number;
          p_passengers: Json;
          p_lock_session: string;
        };
        Returns: string;
      };
      cancel_booking_transaction: {
        Args: { p_booking_id: string; p_user_id: string };
        Returns: boolean;
      };
      reschedule_booking_transaction: {
        Args: {
          p_booking_id: string;
          p_new_flight_id: string;
          p_new_seat_ids: string[];
          p_lock_session: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      cleanup_expired_seat_locks: {
        Args: Record<string, never>;
        Returns: void;
      };
    };

    Enums: {
      seat_status: 'available' | 'locked' | 'booked' | 'blocked';
      cabin_class: 'economy' | 'premium_economy' | 'business' | 'first';
      booking_status: 'pending' | 'confirmed' | 'cancelled' | 'rescheduled';
      flight_status: 'scheduled' | 'boarding' | 'departed' | 'landed' | 'cancelled' | 'delayed';
      payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
      notification_type: 'info' | 'success' | 'warning' | 'error';
    };
  };
}
