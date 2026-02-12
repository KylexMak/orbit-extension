import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Moon, Sun, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { supabase } from '../lib/supabaseClient';

interface SettingsForm {
    sleepStart: string;
    sleepEnd: string;
}

export const SettingsPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const { register, handleSubmit, reset } = useForm<SettingsForm>();

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                if (data) {
                    reset({ sleepStart: data.sleep_start, sleepEnd: data.sleep_end });
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data: SettingsForm) => {
        setSaving(true);
        setSaved(false);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { error } = await supabase.from('profiles').upsert({
                    id: user.id,
                    sleep_start: data.sleepStart,
                    sleep_end: data.sleepEnd
                });
                if (error) throw error;
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            }
        } catch (error) {
            console.error('Error saving profile:', error);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-aurora-bg">
                <Loader2 className="w-8 h-8 animate-spin text-aurora-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-aurora-bg">
            {/* Header */}
            <header className="bg-gradient-to-r from-purple-500 via-purple-400 to-blue-400 px-6 py-6">
                <h1 className="text-2xl font-bold text-white">Settings</h1>
                <p className="text-white/80 text-sm mt-0.5">Manage your Orbit preferences</p>
            </header>

            {/* Content */}
            <div className="max-w-lg mx-auto p-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-aurora-text mb-1">Sleep Schedule</h2>
                    <p className="text-aurora-muted text-sm mb-6">
                        Let us know your rhythm so we can plan around your rest.
                    </p>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2 text-aurora-text">
                                <Moon className="w-4 h-4 text-aurora-primary" />
                                I sleep at...
                            </label>
                            <Input
                                type="time"
                                defaultValue="23:00"
                                {...register('sleepStart', { required: true })}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2 text-aurora-text">
                                <Sun className="w-4 h-4 text-aurora-secondary" />
                                I wake up at...
                            </label>
                            <Input
                                type="time"
                                defaultValue="07:00"
                                {...register('sleepEnd', { required: true })}
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <Button type="submit" isLoading={saving}>
                                Save Changes
                            </Button>
                            {saved && (
                                <span className="flex items-center gap-1 text-sm text-green-600">
                                    <CheckCircle className="w-4 h-4" /> Saved
                                </span>
                            )}
                        </div>
                    </form>
                </div>

                <div className="text-center text-xs text-aurora-muted mt-8">
                    v1.0.0 • Orbit
                </div>
            </div>
        </div>
    );
};
