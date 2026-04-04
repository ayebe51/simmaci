<?php

namespace App\Filament\Resources;

use App\Filament\Resources\UserResource\Pages;
use App\Models\User;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

class UserResource extends Resource
{
    protected static ?string $model = User::class;
    protected static ?string $navigationIcon = 'heroicon-o-users';
    protected static ?string $navigationLabel = 'Pengguna';
    protected static ?string $modelLabel = 'Pengguna';
    protected static ?int $navigationSort = 10;

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\TextInput::make('name')->label('Nama')->required(),
            Forms\Components\TextInput::make('email')->email()->required()
                ->unique(ignoreRecord: true),
            Forms\Components\TextInput::make('password')->password()
                ->required(fn(string $operation): bool => $operation === 'create')
                ->dehydrated(fn(?string $state) => filled($state)),
            Forms\Components\Select::make('role')
                ->options([
                    'super_admin' => 'Super Admin',
                    'admin_yayasan' => 'Admin Yayasan',
                    'operator' => 'Operator',
                ])->required(),
            Forms\Components\TextInput::make('unit')->label('Unit Kerja'),
            Forms\Components\Select::make('school_id')->label('Sekolah')
                ->relationship('school', 'nama')->searchable()->preload(),
            Forms\Components\Toggle::make('is_active')->label('Aktif')->default(true),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('name')->label('Nama')->searchable()->sortable(),
                Tables\Columns\TextColumn::make('email')->searchable(),
                Tables\Columns\TextColumn::make('role')->badge()
                    ->color(fn(string $state): string => match($state) {
                        'super_admin' => 'danger',
                        'admin_yayasan' => 'warning',
                        'operator' => 'info',
                        default => 'gray',
                    }),
                Tables\Columns\TextColumn::make('unit')->label('Unit'),
                Tables\Columns\IconColumn::make('is_active')->boolean()->label('Aktif'),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('role')
                    ->options(['super_admin' => 'Super Admin', 'admin_yayasan' => 'Admin Yayasan', 'operator' => 'Operator']),
            ])
            ->actions([Tables\Actions\EditAction::make()])
            ->defaultSort('name');
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListUsers::route('/'),
            'create' => Pages\CreateUser::route('/create'),
            'edit' => Pages\EditUser::route('/{record}/edit'),
        ];
    }
}
